# Kalo — Plataforma Web de Delivery Nutricional Transparente

> **Asignatura:** ICI324 Desarrollo Web y Bases de Datos — Universidad de Valparaíso  
> **Integrantes:** Ariadna Espejo — Benjamín Figueroa  
> **Entrega:** Entrega 2 (Migración NoSQL MongoDB Atlas + API REST + Frontend Oficial)  
> **Documento Oficial de Entrega:** [INFORME_ENTREGA_2_KALO.md](INFORME_ENTREGA_2_KALO.md)

---

## 📌 Resumen del Proyecto
**Kalo** es una plataforma web que revoluciona el delivery de comida fusionando **HealthTech + FoodTech**. Resuelve la desinformación calórica, la desconfianza hacia las *Dark Kitchens* y los fraudes en la entrega mediante tres pilares:
1. **Transparencia Nutricional:** Cálculo automático de IMC, metas calóricas diarias y desglose transparente de ingredientes y métodos de cocción.
2. **Auditoría de Dark Kitchens:** Sello e Índice de Transparencia (1-100%) respaldado por fotos verificadas de instalaciones y evaluaciones de la comunidad.
3. **Logística Segura con PIN:** Código ambix de 4 dígitos generado al cliente que el repartidor debe validar en su teclado numérico para completar la entrega.

---

## 🛠️ Arquitectura Tecnológica
* **Frontend:** Vanilla HTML5, CSS3 responsive (paleta oficial Kalo `#1b5e3a` y tipografía *Plus Jakarta Sans*), JavaScript SPA asíncrono.
* **Backend:** Node.js + Express (API RESTful modular).
* **Base de Datos NoSQL:** MongoDB Atlas en la nube (Mongoose ODM, clúster multi-región).
* **Legado Relacional (Entrega 1):** SQLite (`nutridelivery.db`) preservado para análisis comparativo incremental.

---

## 🚀 Puesta en Marcha Local

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar el servidor
node server.js