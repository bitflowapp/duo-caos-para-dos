# Diseño de juego — DUO: Caos para Dos

## Identidad

**Mundo 1: La Isla del Caos.** Una isla tropical al atardecer con playas, selva,
acantilados y un volcán picante. Dos protagonistas originales:

- **Chispa** — criatura redonda de colores de atardecer con una llamita en la cabeza.
  Impulsiva, competitiva y cariñosa. Cuatro apariencias: Atardecer, Frutilla, Mandarina, Dorada.
- **Bruma** — criatura-nube con marca de luna y un rulito con estrellita. Tranquila,
  ingeniosa y bromista. Cuatro apariencias: Lavanda, Menta, Medianoche, Algodón.

Cada jugador es uno de los dos (refuerza la identidad de dúo y las barreras de color
de Sincronizados). Accesorios desbloqueables por logros: flor, gorrito de fiesta,
pañuelo pirata, anteojos de corazón, coronita, gorro de chef, gorrito de lana, aureola.

Expresiones animadas: alegría, sorpresa, mareo, tristeza, enamoramiento (beso),
determinación, festejo y abrazo.

## Flujo

Inicio → Crear partida (o abrir el enlace) → Sala privada → Elegir personaje,
apariencia y accesorio → Elegir juego (o la **Gira por la Isla**: los tres seguidos)
→ Ambos "¡Estoy listo!" → Cuenta regresiva → Juego → Resultados y puntos →
**Revancha** / **Siguiente juego** / **Elegir otro juego**, siempre en la misma sala.

Reacciones (corazón, risa, sorpresa, beso, grrr, aplausos) disponibles en el lobby,
resultados y durante el juego (los personajes reaccionan en pantalla).

## A. Carrera del Caos (competitivo, ~60–90 s)

- **Objetivo**: llegar primero a la meta del volcán.
- **Controles**: correr es automático. **Saltar** (mantener = más alto; en el aire,
  segundo salto) y **Deslizar** (agacharse bajo ramas/gaviotas; en el aire, clavado).
  Botón de **ítem** cuando hay uno. Teclado: Espacio/↑, ↓, Shift.
- **Pista**: 17 bloques diseñados a mano en 4 zonas (playa, selva, acantilados,
  volcán). Una semilla elige y ordena los bloques → cada revancha es distinta.
  Obstáculos: erizos, cangrejos, ramas bajas, gaviotas, pinches, pozos, muros;
  ayudas: resortes, flechas turbo, plataformas, una "ruta alta" opcional.
- **Corazones** coleccionables (cada jugador los suyos): +10 puntos c/u.
- **Cajas del Caos**: ítem con ruleta. Quien va atrás recibe ítems más fuertes
  (*rubber banding*): Turbo, Cáscara de mango (trampa para el rival), Nube gruñona
  (lo frena), Beso volador (lo "derrite" un segundo), Corazón escudo.
- **Eventos de caos** cada ~20 s (anunciados): gravedad lunar, turbo para todos,
  viento en contra.
- **Caídas**: reaparecés en el último punto de control. Golpes: mareo breve.
- **Puntos**: ganador 500 · empate 400 · llegó segundo 250 · no llegó 150;
  +10 por corazón; +100 "Impecable" (sin golpes ni caídas).
- Fin: cuando llegan los dos, o 12 s después del primero, o a los 2:40.

## B. Sincronizados (cooperativo, ~2–4 min)

El Templo de los Dos Corazones, 4 salas en las que **cada uno abre el camino del otro**:

1. **Placa y puerta**: una placa abre la puerta mientras alguien la pisa; del otro lado
   hay otra placa para devolver el favor.
2. **Barreras de color**: solo Chispa cruza la barrera cálida (sol) para pisar la placa
   que extiende el puente; Bruma lo cruza y sostiene la placa de la otra orilla para
   que Chispa pase. Solo Bruma cruza la barrera fría (luna) para activar la palanca
   que abre la puerta… y apaga la barrera.
3. **El ascensor de los dos**: sube solo si ambos están arriba; con uno se queda quieto.
4. **Sincronía final**: dos consolas separadas (una sobre un pilar al que se llega
   saltando sobre espinas). Hay que presionarlas **a la vez** (ventana de 0,8 s,
   medida en ticks de simulación de cada jugador, sin depender de la latencia).
   Botón **"Contar 3, 2, 1"**: cuenta regresiva sincronizada en ambos celulares.
   Luego ambos entran juntos al Portal del Corazón.

- **Controles**: ◀ ▶, Saltar y **Acción** (se ilumina cerca de palancas/consolas).
- Caídas al agua/espinas: reaparecés en la sala actual (contador de "chapuzones").
- **Estrellas**: 3 ★ ≤ 2:30 y ≤ 4 caídas; 2 ★ ≤ 4:00; 1 ★ completado.
- **Puntos** (iguales para ambos): 600 + 150 × estrellas. Sin completar: 100 por sala.
- Límite 5 min. Pistas contextuales por sala y carteles en el escenario.

## C. ¿Cuánto me conocés? (romántico/humor, ~3–4 min)

Estudio de TV con podios, luces y reacciones. 8 preguntas por ronda:

- **Predicción** (×4, dos sobre cada uno): quien es "protagonista" responde sobre sí;
  el otro adivina. Acierto: +100 al que adivina, +50 al protagonista ("te conoce").
- **¿Quién es más probable…?** (×2): ambos eligen a uno de los dos; si coinciden, +75 c/u.
- **Telepatía** (×2): ambos intentan elegir lo mismo sin hablar; si coinciden, +75 c/u.
- 20 s por pregunta; **revelación simultánea**; frase humorística según el resultado.
- **Pasar** cambia la pregunta (hasta 3 veces por ronda) y nunca resta puntos.
- Mazo **Liviano** (humor y gustos) o **Con romance** (agrega preguntas de cariño,
  siempre omitibles). 160 preguntas originales en español rioplatense.
- Final: puntos, **% de sintonía** y título ("Almas gemelas", "Telepatía nivel
  experto", …). Sin preguntas sobre ex, celos, dinero, cuerpo, religión ni política.

## Gira por la Isla

Los tres juegos seguidos (carrera → templo → quiz), puntos acumulados y **Copa de la
Isla** al final. La revancha arranca una gira nueva.

## Progresión (sin cuentas)

Por dispositivo (localStorage): partidas, victorias, mejores marcas, corazones de
pareja acumulados, historial de las últimas 30 partidas y 10 logros (7 desbloquean
accesorios). En la sala: estadísticas de la sesión (victorias de cada uno, empates,
templos superados y corazones de la pareja).

## Romance y humor (opcionales)

Celebración y **abrazo** de los personajes tras cada partida, beso volador como ítem
cómico, preguntas románticas solo si se eligen y siempre omitibles, mensajes
divertidos y reacciones. Nada de humillación, celos ni presión.
