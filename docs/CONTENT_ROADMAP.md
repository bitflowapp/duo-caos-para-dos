# Plan de expansión de contenido

Criterio: cada incorporación debe ser **completa y jugable** antes de pasar a la
siguiente. La arquitectura ya soporta minijuegos nuevos: cada uno es una clase
`GameInstance` en el servidor (`apps/server/src/games`), una simulación/lógica en
`packages/shared` y una escena en `apps/web/src/game/scenes`.

## Próximos minijuegos (en orden sugerido)

| # | Minijuego | Tipo | Idea de diseño | Reutiliza |
|---|-----------|------|----------------|-----------|
| 1 | **Batalla de Reflejos** | competitivo, 45 s | Rondas de "¡YA!" con señal sincronizada por el reloj del servidor; gana quien toca primero el objeto correcto. Penaliza tocar antes. | Reloj de partida, quiz (temporizadores) |
| 2 | **Robo de Corazones** | competitivo, 90 s | Arena con plataformas: corazones aparecen (semilla del servidor); atrapar, robarle al otro con un empujón, evitar trampas. | Sim. de plataformas del cooperativo |
| 3 | **Cocina Descontrolada** | cooperativo, 3 min | Pedidos con ingredientes repartidos: uno corta, otro cocina; estaciones como mecanismos del servidor. | Mecanismos de Sincronizados |
| 4 | **Puentes Imposibles** | cooperativo | Cada jugador ve y controla los mecanismos del camino del OTRO (información asimétrica). | Puente/ascensor/palancas |
| 5 | **Memoria Compartida** | cooperativo | Cada celular ve la mitad de un patrón; hay que reconstruirlo hablando. | Quiz (revelación privada) |
| 6 | **Caos Aleatorio** | modificador | Rondas de los juegos existentes con reglas que cambian (gravedad, controles espejo, tamaño). | Ventanas de caos de la carrera |
| 7 | **Nuestra Historia** | romántico, opcional | Preguntas personalizadas que la pareja escribe antes (guardadas solo en sus dispositivos). | Quiz; requiere moderación y cifrado local |

## Mundos

1. **La Isla del Caos** (actual): carrera, templo cooperativo y quiz.
2. **El Laboratorio del Amor**: estética de laboratorio pastel; Memoria Compartida,
   Puentes Imposibles y variantes de Sincronizados (consolas con secuencias).
3. **La Ciudad de las Locuras**: Robo de Corazones, Batalla de Reflejos y carrera urbana.
4. **El Reino de los Dos**: desafíos combinados y un final especial (créditos con fotos
   de momentos de la sesión, sin subir nada al servidor).

Cada mundo: paleta, música (nuevas pistas en el motor de síntesis) y 3 juegos.

## Progresión

- Más accesorios y apariencias por logros de cada mundo.
- "Álbum de la pareja" local: momentos destacados (récords, sintonía máxima).
- Desafíos semanales generados por semilla (sin servidor de cuentas).
- Opcional a futuro: cuentas livianas para sincronizar progreso entre dispositivos
  (requeriría base de datos, política de privacidad y consentimiento explícito).

## Técnica pendiente para escalar

- Persistencia de salas (Redis) para sobrevivir reinicios y escalar horizontalmente con
  el adaptador de Socket.IO.
- Pruebas en dispositivos físicos (ver checklist en `docs/TESTING.md`).
- Localización a otros idiomas (textos ya centralizados por pantalla).
