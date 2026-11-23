// Centro de notificaciones: campana en el menú, historial y avisos flotantes.
// Se guardan en localStorage para que sobrevivan al cambio de página del checkout
// (por ejemplo, el aviso del formulario de envío se ve ya en el paso de pago).
import { escaparHTML } from './util.js';

const CLAVE = 'elite_notificaciones';
const MAXIMO = 30;
const DURACION_AVISO = 6000; // milisegundos que queda cada aviso en pantalla
const VIGENCIA_PENDIENTE = 60000; // avisos creados justo antes de cambiar de página

function iconoCampana(clase) {
    return `<svg class="${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
    </svg>`;
}

/* ---- almacenamiento (si el navegador no deja guardar, el aviso igual se muestra) ---- */

function leer() {
    try {
        const guardadas = JSON.parse(localStorage.getItem(CLAVE));
        return Array.isArray(guardadas) ? guardadas : [];
    } catch {
        return [];
    }
}

function guardar(lista) {
    try {
        localStorage.setItem(CLAVE, JSON.stringify(lista));
    } catch {
        /* modo privado o cuota llena: las notificaciones quedan solo en esta página */
    }
}

function normalizarDetalle(detalle) {
    if (!detalle) return [];
    return (Array.isArray(detalle) ? detalle : [detalle]).filter(Boolean).map(String);
}

/* ---- API pública ---- */

// Crea una notificación, la guarda en el historial y la muestra como aviso flotante.
// Con `diferir: true` no se muestra en esta página: se verá al llegar a la siguiente
// (se usa cuando la acción navega enseguida, como los formularios del checkout).
export function notificar({ tipo = 'general', titulo, detalle = [], diferir = false }) {
    const notificacion = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        tipo,
        titulo,
        detalle: normalizarDetalle(detalle),
        fecha: Date.now(),
        leida: false,
        avisada: false,
    };

    guardar([notificacion, ...leer()].slice(0, MAXIMO));

    if (!diferir) {
        mostrarAviso(notificacion);
        marcarAvisada(notificacion.id);
    }

    pintar();
    return notificacion;
}

export function contarNoLeidas() {
    return leer().filter((n) => !n.leida).length;
}

function marcarAvisada(id) {
    guardar(leer().map((n) => (n.id === id ? { ...n, avisada: true } : n)));
}

function marcarTodasLeidas() {
    guardar(leer().map((n) => (n.leida ? n : { ...n, leida: true })));
}

function limpiarNotificaciones() {
    guardar([]);
}

/* ---- interfaz: campana + panel de historial ---- */

export function crearCentroNotificaciones() {
    const menu = document.querySelector('.menu-principal');
    if (!menu || document.querySelector('[data-notificaciones]')) return;

    menu.insertAdjacentHTML(
        'beforeend',
        `<div class="notificaciones" data-notificaciones>
            <button class="notificaciones__boton" type="button" data-boton-notificaciones
                aria-expanded="false" aria-controls="panel-notificaciones" aria-haspopup="true"
                aria-label="Notificaciones">
                ${iconoCampana('notificaciones__icono')}
                <span class="notificaciones__contador" data-contador-notificaciones hidden>0</span>
            </button>
            <section class="notificaciones__panel" id="panel-notificaciones" hidden
                aria-label="Historial de notificaciones">
                <header class="notificaciones__cabecera">
                    <h2 class="notificaciones__titulo">Notificaciones</h2>
                    <button class="notificaciones__limpiar" type="button" data-limpiar-notificaciones>Limpiar</button>
                </header>
                <ul class="notificaciones__lista" data-lista-notificaciones></ul>
                <p class="notificaciones__vacio" data-vacio-notificaciones>Todavía no hay notificaciones.</p>
            </section>
        </div>`
    );

    document.body.insertAdjacentHTML(
        'beforeend',
        '<div class="avisos" data-avisos aria-live="polite" aria-label="Avisos de la tienda"></div>'
    );

    // Los avisos flotantes quedan justo debajo del encabezado, alineados con la campana.
    const encabezado = document.querySelector('.encabezado-principal');
    const contenedorAvisos = document.querySelector('[data-avisos]');
    const ubicarAvisos = () => {
        const altura = encabezado ? encabezado.offsetHeight : 0;
        contenedorAvisos.style.setProperty('--avisos-top', `${Math.max(altura + 12, 12)}px`);
    };
    ubicarAvisos();
    window.addEventListener('resize', ubicarAvisos);

    const boton = document.querySelector('[data-boton-notificaciones]');
    const panel = document.querySelector('#panel-notificaciones');

    boton.addEventListener('click', () => {
        if (panel.hidden) abrirPanel();
        else cerrarPanel();
    });

    document.querySelector('[data-limpiar-notificaciones]').addEventListener('click', () => {
        limpiarNotificaciones();
        pintar();
    });

    // Cerrar al hacer clic fuera del panel o al presionar Escape.
    document.addEventListener('click', (e) => {
        if (!panel.hidden && !e.target.closest('[data-notificaciones]')) cerrarPanel();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !panel.hidden) {
            cerrarPanel();
            boton.focus();
        }
    });

    pintar();
    avisarPendientes();
}

function abrirPanel() {
    const panel = document.querySelector('#panel-notificaciones');
    const boton = document.querySelector('[data-boton-notificaciones]');
    panel.hidden = false;
    boton.setAttribute('aria-expanded', 'true');
    marcarTodasLeidas(); // al abrir el historial, las notificaciones quedan vistas
    pintar();
}

function cerrarPanel() {
    const panel = document.querySelector('#panel-notificaciones');
    const boton = document.querySelector('[data-boton-notificaciones]');
    if (!panel || !boton) return;
    panel.hidden = true;
    boton.setAttribute('aria-expanded', 'false');
}

function fechaLegible(fecha) {
    return new Date(fecha).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function pintar() {
    const contador = document.querySelector('[data-contador-notificaciones]');
    const lista = document.querySelector('[data-lista-notificaciones]');
    const vacio = document.querySelector('[data-vacio-notificaciones]');
    if (!contador || !lista || !vacio) return;

    const notificaciones = leer();
    const noLeidas = notificaciones.filter((n) => !n.leida).length;

    contador.textContent = noLeidas;
    contador.hidden = noLeidas === 0;

    lista.innerHTML = notificaciones
        .map(
            (n) => `<li class="notificaciones__item notificaciones__item--${escaparHTML(n.tipo)}${
                n.leida ? '' : ' notificaciones__item--nueva'
            }">
                <p class="notificaciones__item-titulo">${escaparHTML(n.titulo)}</p>
                <p class="notificaciones__item-fecha">${fechaLegible(n.fecha)}</p>
                ${
                    n.detalle.length
                        ? `<ul class="notificaciones__item-detalle">${n.detalle
                              .map((linea) => `<li>${escaparHTML(linea)}</li>`)
                              .join('')}</ul>`
                        : ''
                }
            </li>`
        )
        .join('');

    vacio.hidden = notificaciones.length > 0;
}

/* ---- avisos flotantes ---- */

function mostrarAviso(notificacion) {
    const contenedor = document.querySelector('[data-avisos]');
    if (!contenedor) return;

    // Como máximo tres avisos a la vez: si se supera, se descarta el más viejo.
    if (contenedor.children.length >= 3) contenedor.firstElementChild.remove();

    const aviso = document.createElement('div');
    aviso.className = `aviso aviso--${notificacion.tipo}`;
    aviso.setAttribute('role', 'status');
    aviso.innerHTML = `${iconoCampana('aviso__icono')}
        <div class="aviso__cuerpo">
            <p class="aviso__titulo">${escaparHTML(notificacion.titulo)}</p>
            ${
                notificacion.detalle.length
                    ? `<ul class="aviso__detalle">${notificacion.detalle
                          .map((linea) => `<li>${escaparHTML(linea)}</li>`)
                          .join('')}</ul>`
                    : ''
            }
        </div>
        <button class="aviso__cerrar" type="button" data-cerrar-aviso aria-label="Cerrar aviso">×</button>`;

    contenedor.append(aviso);
    sacudirCampana();

    let temporizador = setTimeout(cerrar, DURACION_AVISO);

    function cerrar() {
        clearTimeout(temporizador);
        aviso.classList.add('aviso--saliendo');
        setTimeout(() => aviso.remove(), 200);
    }

    aviso.querySelector('[data-cerrar-aviso]').addEventListener('click', cerrar);
    aviso.addEventListener('mouseenter', () => clearTimeout(temporizador));
    aviso.addEventListener('mouseleave', () => {
        temporizador = setTimeout(cerrar, DURACION_AVISO);
    });
    aviso.addEventListener('focusin', () => clearTimeout(temporizador));
    aviso.addEventListener('focusout', () => {
        temporizador = setTimeout(cerrar, DURACION_AVISO);
    });
}

// Avisos generados justo antes de cambiar de página (para que no se pierdan).
function avisarPendientes() {
    const pendientes = leer()
        .filter((n) => !n.avisada && Date.now() - n.fecha < VIGENCIA_PENDIENTE)
        .slice(0, 3)
        .reverse();

    pendientes.forEach((notificacion) => {
        mostrarAviso(notificacion);
        marcarAvisada(notificacion.id);
    });
}

function sacudirCampana() {
    const boton = document.querySelector('[data-boton-notificaciones]');
    if (!boton) return;
    boton.classList.remove('notificaciones__boton--nueva');
    void boton.offsetWidth; // reinicia la animación si ya estaba activa
    boton.classList.add('notificaciones__boton--nueva');
    setTimeout(() => boton.classList.remove('notificaciones__boton--nueva'), 800);
}
