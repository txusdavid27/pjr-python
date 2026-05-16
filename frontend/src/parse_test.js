const MONTHS = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
]

function formatToInputDate(dia, mes) {
    if (!dia || !mes) return "";
    const m = MONTHS.findIndex(x => x.toLowerCase() === mes.toLowerCase());
    if (m === -1) return "";
    const y = new Date().getFullYear();
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function parseFromInputDate(dateStr) {
    if (!dateStr) return { dia: "", mes: "" };
    const [y, m, d] = dateStr.split('-');
    return {
        dia: parseInt(d, 10).toString(),
        mes: MONTHS[parseInt(m, 10) - 1]
    };
}

function formatToInputTime(horaStr) {
    if (!horaStr) return "";
    // parses "8:00 AM" to "08:00"
    const match = horaStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return "";
    let [_, h, m, p] = match;
    h = parseInt(h, 10);
    if (p.toUpperCase() === "PM" && h < 12) h += 12;
    if (p.toUpperCase() === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}`;
}

function parseFromInputTime(timeStr) {
    if (!timeStr) return "";
    // parses "08:00" to "8:00 AM"
    let [h, m] = timeStr.split(':');
    h = parseInt(h, 10);
    const p = h >= 12 ? "PM" : "AM";
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${p}`;
}

console.log(formatToInputDate("17", "Mayo"));
console.log(parseFromInputDate("2026-05-17"));
console.log(formatToInputTime("8:00 AM"));
console.log(formatToInputTime("12:30 PM"));
console.log(parseFromInputTime("08:00"));
console.log(parseFromInputTime("15:30"));
