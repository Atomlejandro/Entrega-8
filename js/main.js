// SIMULADOR DE COMPRAS (DOM, eventos y localStorage)

const CLAVE_PRODUCTOS = "simulador-productos";
const CLAVE_COMPRAS = "simulador-compras";

// ---------------------------------------------------------------
// 1. CLASE
// ---------------------------------------------------------------
class Producto {
    constructor(nombre, precio, stock, id) {
        this.nombre = nombre;
        this.precio = precio;
        this.stock = stock;
        this.id = id;
        this.ultimoResultado = "Sin compras todavía";
    }

    // Modifica el estado: resta stock si la compra es válida.
    // Devuelve true si la compra se aceptó y false si se rechazó.
    comprarProducto(cantidad) {
        if (!Number.isInteger(cantidad) || cantidad <= 0) {
            this.ultimoResultado = "Compra rechazada: la cantidad debe ser un número entero mayor a 0";
            return false;
        }
        if (cantidad > this.stock) {
            this.ultimoResultado = "Compra rechazada: no hay stock suficiente (disponibles: " + this.stock + ")";
            return false;
        }
        this.stock = this.stock - cantidad;
        this.ultimoResultado = "Compra aceptada";
        return true;
    }

    // Solo informa: lee lo que quedó guardado en el objeto.
    mostrarCompra() {
        return this.ultimoResultado + ". Quedan " + this.stock + " artículos de " + this.nombre + " en el inventario.";
    }
}

// ---------------------------------------------------------------
// 2. STORAGE
// ---------------------------------------------------------------

// Datos de partida cuando el storage está vacío
function crearProductosIniciales() {
    return [
        new Producto("Mouse", 100, 10, "001"),
        new Producto("Televisor", 500, 8, "002"),
        new Producto("Teclado", 150, 16, "003"),
        new Producto("Monitor", 300, 6, "004"),
        new Producto("Cargador", 40, 25, "005"),
        new Producto("Audífonos", 120, 0, "006")
    ];
}

// JSON.parse devuelve objetos planos (sin métodos).
// DESTRUCTURING en el parámetro: se vuelve a crear la instancia de Producto.
function crearProductoDesdeDatos({ nombre, precio, stock, id, ultimoResultado }) {
    const producto = new Producto(nombre, precio, stock ?? 0, id);
    producto.ultimoResultado = ultimoResultado ?? producto.ultimoResultado;
    return producto;
}

const esObjeto = (dato) => dato !== null && typeof dato === "object";

// RECUPERAR: devuelve un array o null si no hay nada (o si el dato está dañado)
function leerStorage(clave) {
    try {
        const datos = JSON.parse(localStorage.getItem(clave));
        return Array.isArray(datos) ? datos.filter(esObjeto) : null;
    } catch (error) {
        return null;
    }
}

// ALMACENAR / MODIFICAR: devuelve true si se pudo guardar
function guardarStorage(clave, datos) {
    try {
        localStorage.setItem(clave, JSON.stringify(datos));
        return true;
    } catch (error) {
        return false;
    }
}

// BORRAR
function borrarStorage(clave) {
    try {
        localStorage.removeItem(clave);
    } catch (error) {
        // si el navegador no permite usar el storage, no hay nada que borrar
    }
}

// ---------------------------------------------------------------
// 3. DATOS (se cargan desde el storage si existen)
// ---------------------------------------------------------------
// ?. evita un error si no hay datos guardados, y ?? usa los iniciales solo si es null/undefined
const productos = leerStorage(CLAVE_PRODUCTOS)?.map(crearProductoDesdeDatos) ?? crearProductosIniciales();
const compras = leerStorage(CLAVE_COMPRAS) ?? [];
let idResaltado = null; // producto que se resalta tras una acción

// ---------------------------------------------------------------
// 4. SELECCIÓN DE ELEMENTOS DEL DOM
// ---------------------------------------------------------------
const inputNombre = document.getElementById("nombre");
const inputPrecio = document.getElementById("precio");
const inputStock = document.getElementById("stock");
const btnAgregar = document.getElementById("agregar");

const contenedorProductos = document.getElementById("lista-productos");
const inputBuscar = document.getElementById("buscar");
const btnRestablecer = document.getElementById("restablecer");

const selectCompra = document.getElementById("compra");
const inputCantidad = document.getElementById("cantidad");
const btnComprar = document.getElementById("comprar");

const contenedorResumen = document.getElementById("resultado-compra");
const btnVaciarCompra = document.getElementById("vaciar-compra");
const mensajeFeedback = document.getElementById("mensaje");

// ---------------------------------------------------------------
// 5. FUNCIONES AUXILIARES
// ---------------------------------------------------------------
const formatoPesos = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
});

// Evita que un nombre con símbolos como < o > rompa el HTML
function escaparHTML(texto) {
    return texto
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// FEEDBACK VISUAL: muestra un mensaje en pantalla (exito, error o aviso)
let temporizadorMensaje;
function mostrarMensaje(texto, tipo) {
    mensajeFeedback.textContent = texto;
    mensajeFeedback.className = "mensaje " + (tipo || "aviso"); // || usa "aviso" si no llega tipo

    clearTimeout(temporizadorMensaje);
    temporizadorMensaje = setTimeout(() => {
        mensajeFeedback.textContent = "";
        mensajeFeedback.className = "mensaje";
    }, 6000);
}

// Descuento por volumen
function obtenerDescuento(cantidadComprada) {
    if (cantidadComprada >= 100) {
        return 0.20;
    } else if (cantidadComprada >= 50) {
        return 0.15;
    } else if (cantidadComprada >= 20) {
        return 0.10;
    }
    return 0;
}

function calculadoraPrecios(cantidadComprada, precioUnitario) {
    const precioSinDescuento = cantidadComprada * precioUnitario;
    return precioSinDescuento - (precioSinDescuento * obtenerDescuento(cantidadComprada));
}

// ---------------------------------------------------------------
// 6. RENDERIZADO DINÁMICO
// ---------------------------------------------------------------

// Dibuja las tarjetas de productos (filtradas por lo que escribe el usuario)
function renderizarProductos() {
    const termino = inputBuscar.value.trim().toLowerCase();

    if (productos.length === 0) {
        contenedorProductos.innerHTML = `<p class="vacio">No hay productos en el inventario.</p>`;
        return;
    }

    const visibles = productos.filter(({ nombre }) => nombre.toLowerCase().includes(termino));

    if (visibles.length === 0) {
        contenedorProductos.innerHTML = `<p class="vacio">Ningún producto coincide con "${escaparHTML(termino)}".</p>`;
        return;
    }

    contenedorProductos.innerHTML = visibles.map(({ id, nombre, precio, stock }) => {
        const estado = stock === 0 ? "agotado" : stock <= 3 ? "stock-bajo" : "";
        const resaltado = id === idResaltado ? "nuevo" : "";
        const textoStock = stock === 0 ? "Agotado" : "Stock: " + stock;

        return `
            <article class="tarjeta ${estado} ${resaltado}">
                <h3>${escaparHTML(nombre)}</h3>
                <p class="precio">${formatoPesos.format(precio)}</p>
                <p class="stock">${textoStock}</p>
                <button class="btn-eliminar" data-id="${id}">Eliminar</button>
            </article>
        `;
    }).join("");
}

// Llena el select de compra solo con productos que tienen stock
function renderizarSelect() {
    const seleccionado = selectCompra.value;
    const disponibles = productos.filter(({ stock }) => stock > 0);

    selectCompra.innerHTML = `<option value="">Selecciona un producto</option>` +
        disponibles.map(({ id, nombre, precio, stock }) => `
            <option value="${id}">${escaparHTML(nombre)} — ${formatoPesos.format(precio)} (stock: ${stock})</option>
        `).join("");

    // Conserva la selección si el producto sigue disponible
    if (disponibles.some(({ id }) => id === seleccionado)) {
        selectCompra.value = seleccionado;
    }
}

// Dibuja el resumen de la compra con el total
function renderizarResumen() {
    if (compras.length === 0) {
        contenedorResumen.innerHTML = `<p class="vacio">Aún no has registrado compras.</p>`;
        return;
    }

    const totalUnidades = compras.reduce((acumulado, { cantidad }) => acumulado + cantidad, 0);
    const totalAPagar = compras.reduce((acumulado, { subtotal }) => acumulado + subtotal, 0);

    const filas = compras.map(({ nombre, cantidad, subtotal }) => {
        const descuento = Math.round(obtenerDescuento(cantidad) * 100);
        const etiqueta = descuento > 0 ? `<span class="etiqueta">-${descuento} %</span>` : "";
        return `
            <li>
                <span>${escaparHTML(nombre)} × ${cantidad} ${etiqueta}</span>
                <strong>${formatoPesos.format(subtotal)}</strong>
            </li>
        `;
    }).join("");

    contenedorResumen.innerHTML = `
        <ul class="resumen-lista">${filas}</ul>
        <p class="total">${totalUnidades === 1 ? "1 unidad" : totalUnidades + " unidades"} · Total a pagar: ${formatoPesos.format(totalAPagar)}</p>
    `;
}

// Vuelve a dibujar todo lo que depende de los datos
function actualizarVista() {
    renderizarProductos();
    renderizarSelect();
    renderizarResumen();
}

// ---------------------------------------------------------------
// 7. SINCRONIZACIÓN: array -> localStorage -> vista
// ---------------------------------------------------------------

// Guarda los dos arrays en el storage. Devuelve true si todo se guardó.
function guardarEstado() {
    const productosGuardados = guardarStorage(CLAVE_PRODUCTOS, productos);
    const comprasGuardadas = guardarStorage(CLAVE_COMPRAS, compras);
    return productosGuardados && comprasGuardadas;
}

// Cierra cada acción: guarda, vuelve a dibujar y avisa al usuario.
// Se llama después de actualizar el array de datos.
function finalizarAccion(texto, tipo) {
    const guardado = guardarEstado();
    actualizarVista();
    mostrarMensaje(
        guardado ? texto : texto + " (no se pudo guardar en el navegador)",
        guardado ? tipo : "aviso"
    );
}

// ---------------------------------------------------------------
// 8. EVENTOS
// ---------------------------------------------------------------
function leerFormulario() {
    return {
        nombre: inputNombre.value.trim(),
        precio: Number(inputPrecio.value),
        stock: Number(inputStock.value)
    };
}

// Click en "Agregar": lee el formulario, valida y crea un Producto
function agregarProducto() {
    const { nombre, precio, stock } = leerFormulario();

    if (nombre === "") {
        mostrarMensaje("Escribe el nombre del producto.", "error");
        return;
    }
    if (!(precio > 0)) {
        mostrarMensaje("El precio debe ser un número mayor a 0.", "error");
        return;
    }
    if (!Number.isInteger(stock) || stock <= 0) {
        mostrarMensaje("La cantidad debe ser un número entero mayor a 0.", "error");
        return;
    }
    if (productos.some((producto) => producto.nombre.toLowerCase() === nombre.toLowerCase())) {
        mostrarMensaje("Ya existe un producto llamado \"" + nombre + "\".", "error");
        return;
    }

    // Nuevo id: el mayor id actual + 1, con ceros a la izquierda ("007")
    const nuevoId = String(productos.reduce((mayor, { id }) => Math.max(mayor, Number(id)), 0) + 1).padStart(3, "0");

    productos.push(new Producto(nombre, precio, stock, nuevoId));
    idResaltado = nuevoId;

    inputNombre.value = "";
    inputPrecio.value = "";
    inputStock.value = "";
    inputNombre.focus();

    finalizarAccion("\"" + nombre + "\" se agregó al inventario.", "exito");
}

// Click en "Comprar": usa el método comprarProducto de la clase
function registrarCompra() {
    const producto = productos.find((item) => item.id === selectCompra.value);
    const cantidad = Number(inputCantidad.value);

    if (producto === undefined) {
        mostrarMensaje("Selecciona un producto para comprar.", "error");
        return;
    }

    if (!producto.comprarProducto(cantidad)) {
        mostrarMensaje(producto.ultimoResultado, "error");
        return;
    }

    const { id, nombre, precio } = producto;
    const existente = compras.find((compra) => compra.id === id);

    if (existente !== undefined) {
        // Si ya compró este producto, se acumulan las unidades y se recalcula el descuento
        existente.cantidad += cantidad;
        existente.subtotal = calculadoraPrecios(existente.cantidad, precio);
    } else {
        compras.push({ id, nombre, cantidad, subtotal: calculadoraPrecios(cantidad, precio) });
    }

    idResaltado = id;
    inputCantidad.value = "";
    finalizarAccion(producto.mostrarCompra(), "exito");
}

// Click en "Eliminar": un solo evento en el contenedor atiende a todos los botones
// (los botones se crean dinámicamente, así que se delega el evento)
function eliminarProducto(evento) {
    const id = evento.target.closest(".btn-eliminar")?.dataset.id; // ?. por si el clic no fue en un botón
    if (id === undefined) {
        return;
    }

    const indice = productos.findIndex((producto) => producto.id === id);
    if (indice === -1) {
        return;
    }

    const [eliminado] = productos.splice(indice, 1);
    idResaltado = null;

    finalizarAccion("\"" + eliminado.nombre + "\" se eliminó del inventario.", "aviso");
}

// Click en "Limpiar resumen": vacía las compras guardadas (el stock no se repone)
function vaciarCompra() {
    if (compras.length === 0) {
        mostrarMensaje("No hay compras en el resumen.", "aviso");
        return;
    }

    compras.splice(0, compras.length);
    finalizarAccion("Se limpió el resumen de compras.", "aviso");
}

// Click en "Restablecer inventario": borra los datos guardados y vuelve a los iniciales
function restablecerInventario() {
    borrarStorage(CLAVE_PRODUCTOS);
    borrarStorage(CLAVE_COMPRAS);

    productos.splice(0, productos.length, ...crearProductosIniciales());
    compras.splice(0, compras.length);
    idResaltado = null;
    inputBuscar.value = "";

    actualizarVista();
    mostrarMensaje("Se borraron los datos guardados y se restableció el inventario inicial.", "aviso");
}

// Evento de teclado: filtra la lista mientras el usuario escribe
function filtrarProductos() {
    idResaltado = null;
    renderizarProductos();
}

btnAgregar.addEventListener("click", agregarProducto);
btnComprar.addEventListener("click", registrarCompra);
btnVaciarCompra.addEventListener("click", vaciarCompra);
btnRestablecer.addEventListener("click", restablecerInventario);
contenedorProductos.addEventListener("click", eliminarProducto);
inputBuscar.addEventListener("keyup", filtrarProductos);

// ---------------------------------------------------------------
// 9. INICIO
// ---------------------------------------------------------------
actualizarVista();
