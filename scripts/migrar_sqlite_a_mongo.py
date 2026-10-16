import sqlite3
import json
import os
import math
from datetime import datetime

def calcular_imc(peso, altura):
    try:
        if peso and altura and altura > 0:
            # Si altura se ingresó en cm (ej. 170), convertir a metros
            if altura > 3.0:
                altura = altura / 100.0
            return round(peso / (altura ** 2), 2)
    except Exception:
        pass
    return None

def calcular_meta_calorica(peso, altura, edad, genero):
    # Fórmula aproximada de Harris-Benedict
    try:
        if not (peso and altura and edad):
            return 2000
        h_cm = altura * 100.0 if altura < 3.0 else altura
        if genero and genero.lower().startswith('f'):
            tmb = 655 + (9.6 * peso) + (1.8 * h_cm) - (4.7 * edad)
        else:
            tmb = 66 + (13.7 * peso) + (5.0 * h_cm) - (6.8 * edad)
        return int(round(tmb * 1.375)) # Factor actividad ligera
    except Exception:
        return 2000

def migrar():
    db_path = os.path.join(os.path.dirname(__file__), '..', 'nutridelivery.db')
    out_dir = os.path.join(os.path.dirname(__file__), '..', 'data', 'mongodb')
    os.makedirs(out_dir, exist_ok=True)

    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    # 1. Migrar Clientes a Usuarios
    print("[1/3] Extrayendo Clientes de SQLite...")
    cur.execute("SELECT * FROM Cliente")
    clientes = cur.fetchall()

    usuarios_mongo = []
    id_map_usuarios = {} # id_sqlite -> id_mongo

    for cli in clientes:
        cid = cli['Id_cliente']
        # Generar un ID de 24 hex caracteres válido para MongoDB ObjectId
        mongo_id = f"6620f1a4e13b8a1c90{cid:06d}"
        id_map_usuarios[cid] = mongo_id

        peso = cli['Peso']
        altura = cli['Altura']
        edad = cli['Edad']
        genero = cli['Genero']
        telefono = cli['Telefono'] if 'Telefono' in cli.keys() and cli['Telefono'] else "+56912345678"

        imc = calcular_imc(peso, altura)
        meta_cal = calcular_meta_calorica(peso, altura, edad, genero)

        usuario_doc = {
            "_id": mongo_id,
            "nombre": cli['Nombre'],
            "correo": cli['Correo'],
            "password_hash": f"$2b$10$hashed_{cli['Password']}",
            "telefono": telefono,
            "activo": True,
            "fecha_registro": "2026-03-01T12:00:00.000Z",
            "perfil_biometrico": {
                "peso_kg": peso,
                "altura_m": round(altura if altura < 3.0 else altura / 100.0, 2) if altura else None,
                "edad": edad,
                "genero": genero,
                "imc": imc,
                "meta_calorica_diaria": meta_cal,
                "objetivo_salud": "Mantenimiento y nutrición balanceada"
            }
        }
        usuarios_mongo.append(usuario_doc)

    # 2. Migrar Planes Nutricionales
    print("[2/3] Extrayendo Planes Nutricionales de SQLite...")
    cur.execute("SELECT * FROM PlanNutricional")
    planes = cur.fetchall()

    planes_mongo = []
    id_map_planes = {} # id_sqlite -> doc completo

    for pl in planes:
        pid = pl['Id_plan']
        mongo_id = f"6620f2b8e13b8a1c90{pid:06d}"
        
        plan_doc = {
            "_id": mongo_id,
            "nombre_plan": pl['NombrePlan'],
            "calorias_diarias": pl['CaloriasDiarias'],
            "objetivo": pl['Objetivo'],
            "precio_mensual": pl['PrecioMensual'],
            "activo": True,
            "tags": ["nutricion", "saludable", "dark kitchen"]
        }
        id_map_planes[pid] = plan_doc
        planes_mongo.append(plan_doc)

    # 3. Migrar Pedidos (Aplicando Referencia Extendida y Snapshot)
    print("[3/3] Extrayendo Pedidos de SQLite y aplicando patrones NoSQL...")
    cur.execute("SELECT * FROM Pedido")
    pedidos = cur.fetchall()

    pedidos_mongo = []
    for ped in pedidos:
        ped_id = ped['Id_pedido']
        mongo_id = f"6620f39de13b8a1c90{ped_id:06d}"
        
        cid = ped['Id_cliente']
        pid = ped['Id_plan']
        
        # Buscar usuario y plan correspondientes
        usuario = next((u for u in usuarios_mongo if u['_id'] == id_map_usuarios.get(cid)), None)
        plan = id_map_planes.get(pid)

        # PIN de seguridad de 4 dígitos (requerimiento logístico de Kalo)
        pin = f"{(ped_id * 1337 + 1000) % 9000 + 1000}"

        pedido_doc = {
            "_id": mongo_id,
            "codigo_pedido": f"KALO-2026-{ped_id:04d}",
            "fecha_pedido": f"{ped['Fecha'].replace(' ', 'T')}.000Z" if ped['Fecha'] else "2026-10-16T12:00:00.000Z",
            "estado": ped['Estado'],
            "pin_seguridad": pin,
            # Patrón de Referencia Extendida
            "cliente": {
                "usuario_id": id_map_usuarios.get(cid, "6620f1a4e13b8a1c90000001"),
                "nombre": usuario['nombre'] if usuario else "Cliente Desconocido",
                "correo": usuario['correo'] if usuario else "sin_correo@mail.com",
                "telefono": usuario['telefono'] if usuario else "+56912345678"
            },
            # Snapshot histórico del plan contratado
            "plan_adquirido": {
                "plan_id": plan['_id'] if plan else "6620f2b8e13b8a1c90000001",
                "nombre_plan": plan['nombre_plan'] if plan else "Plan Personalizado",
                "calorias_diarias": plan['calorias_diarias'] if plan else 2000,
                "precio_historico": ped['Total'] if ped['Total'] else (plan['precio_mensual'] if plan else 49.99)
            },
            "total": ped['Total']
        }
        pedidos_mongo.append(pedido_doc)

    con.close()

    # Guardar en archivos JSON
    path_usuarios = os.path.join(out_dir, 'usuarios.json')
    path_planes = os.path.join(out_dir, 'planes_nutricionales.json')
    path_pedidos = os.path.join(out_dir, 'pedidos.json')

    with open(path_usuarios, 'w', encoding='utf-8') as f:
        json.dump(usuarios_mongo, f, indent=2, ensure_ascii=False)

    with open(path_planes, 'w', encoding='utf-8') as f:
        json.dump(planes_mongo, f, indent=2, ensure_ascii=False)

    with open(path_pedidos, 'w', encoding='utf-8') as f:
        json.dump(pedidos_mongo, f, indent=2, ensure_ascii=False)

    print("\n ¡Migración completada con éxito!")
    print(f" -> {len(usuarios_mongo)} usuarios exportados a: {path_usuarios}")
    print(f" -> {len(planes_mongo)} planes exportados a: {path_planes}")
    print(f" -> {len(pedidos_mongo)} pedidos exportados a: {path_pedidos}")

if __name__ == '__main__':
    migrar()

