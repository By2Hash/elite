// Vista del paso 3: muestra el pedido guardado (JSON) en pantalla.
import '../modulos/comun.js';
import { obtenerPedido } from '../modulos/almacen.js';
import { notificar } from '../modulos/notificaciones.js';
import { pintarProductosResumen, pintarTotales } from '../modulos/render.js';
import { escaparHTML, formatearPrecio } from '../modulos/util.js';
import { crearEnlaceWhatsApp, mensajePedido } from '../modulos/whatsapp.js';

const pedido = obtenerPedido();

if (!pedido) {
    location.replace('index.html'); // no hay pedido que mostrar
} else {
    document.querySelector('#pedido-numero').textContent = `Pedido Nº ${pedido.numero}`;
    document.querySelector('#pedido-texto').innerHTML =
        `Guardamos tus datos de contacto (<strong>${escaparHTML(pedido.cliente.email)}</strong>). ` +
        `Para confirmar la compra, enviá el detalle por WhatsApp con el botón de abajo. ` +
        `La entrega está prevista en ${escaparHTML(pedido.cliente.direccion)}, ${escaparHTML(pedido.cliente.ciudad)}, en los próximos días hábiles.`;
    pintarProductosResumen(document.querySelector('#resumen-productos'), pedido.items);
    pintarTotales(document.querySelector('#resumen-totales'), pedido);

    // Envío real del pedido por WhatsApp: el mensaje ya viene armado.
    const botonWhatsApp = document.querySelector('#enviar-whatsapp');
    botonWhatsApp.href = crearEnlaceWhatsApp(mensajePedido(pedido));
    botonWhatsApp.hidden = false;
    botonWhatsApp.addEventListener('click', () => {
        notificar({
            tipo: 'whatsapp',
            titulo: 'Pedido enviado por WhatsApp',
            detalle: [
                `Pedido ${pedido.numero}`,
                `Total: ${formatearPrecio(pedido.total)}`,
                'Se abrió WhatsApp con el detalle del pedido.',
            ],
        });
    });
}
