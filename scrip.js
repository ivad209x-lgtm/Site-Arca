// ============================================================
// ARCA - script.js
// Navegação + Firebase + gráficos + demonstração + ESP32
// ============================================================

// ============================================================
// 1. FIREBASE
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
    getDatabase,
    ref,
    onValue
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";


// Configuração do projeto Firebase ARCA
const firebaseConfig = {
    apiKey: "AIzaSyC1lmcq28WPLftAEyXlXqx77kchGn_kuT0",
    authDomain: "projeto-arca-16555.firebaseapp.com",
    databaseURL: "https://projeto-arca-16555-default-rtdb.firebaseio.com",
    projectId: "projeto-arca-16555",
    storageBucket: "projeto-arca-16555.firebasestorage.app",
    messagingSenderId: "31949635862",
    appId: "1:31949635862:web:89fce6b849c33f3cdd1037"
};


// Inicializa Firebase
const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);
const auth = getAuth(firebaseApp);

console.log("Firebase inicializado no ARCA.");


// ============================================================
// 2. VARIÁVEIS
// ============================================================

let socket = null;

let demoTimer = null;

let firebaseRecebeuDados = false;

let lastTelemetry = null;


// ============================================================
// 3. DADOS DE DEMONSTRAÇÃO
// ============================================================

const demoTelemetry = {

    robot: {
        battery: 78,
        speed: 0.7,
        internalTemp: 31,
        compartment: 64,
        mode: "AUTÔNOMO"
    },

    water: {
        temperature: 24.3,
        ph: 7.2,
        turbidity: 1.8,
        oxygen: 6.4,
        conductivity: 320,
        orp: 680,
        chlorine: 0.35,
        fluoride: 0.7
    },

    gps: {
        lat: -23.5505,
        lon: -46.6333,
        speed: 0.7,
        distance: 2.4,
        satellites: 9
    }

};


// ============================================================
// 4. HISTÓRICO DOS GRÁFICOS
// ============================================================

const history = {

    tds: [
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0
    ],

    temperature: [
        23.9, 24.0, 24.1, 24.0,
        24.2, 24.1, 24.2, 24.1,
        24.2, 24.3, 24.2, 24.3
    ],

    ph: [
        7.1, 7.2, 7.2, 7.1,
        7.3, 7.2, 7.2, 7.1,
        7.2, 7.2, 7.3, 7.2
    ],

    turbidity: [
        2.1, 2.0, 1.9, 1.9,
        1.8, 1.9, 1.7, 1.8,
        1.8, 1.7, 1.8, 1.8
    ],

    oxygen: [
        6.0, 6.1, 6.2, 6.1,
        6.3, 6.2, 6.4, 6.3,
        6.4, 6.3, 6.4, 6.4
    ],

    conductivity: [
        310, 315, 318, 316,
        320, 319, 321, 318,
        322, 320, 321, 320
    ],

    orp: [
        650, 658, 665, 660,
        670, 672, 678, 675,
        680, 678, 681, 680
    ]

};


const labels24 = [
    "00h",
    "02h",
    "04h",
    "06h",
    "08h",
    "10h",
    "12h",
    "14h",
    "16h",
    "18h",
    "20h",
    "22h"
];


// ============================================================
// 5. FUNÇÕES AUXILIARES
// ============================================================

function fmt(value, decimals = 1) {

    if (
        value === null ||
        value === undefined ||
        Number.isNaN(Number(value))
    ) {
        return "--";
    }

    return Number(value).toLocaleString(
        "pt-BR",
        {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }
    );
}


function setText(id, value) {

    const element = document.getElementById(id);

    if (!element) {
        return;
    }

    element.textContent = value;
}


// ============================================================
// 6. STATUS DA CONEXÃO
// ============================================================

function setConnection(status, detail, online = false) {

    setText("connectionStatus", status);

    setText("connectionDetail", detail);

    const pill = document.querySelector(".topright .online");

    if (pill) {

        pill.textContent = online
            ? "● SISTEMA ONLINE"
            : "● SEM CONEXÃO";

        pill.classList.toggle("online", online);
    }
}


// ============================================================
// 7. NAVEGAÇÃO
// ============================================================

function showPage(page) {

    document.querySelectorAll(".page").forEach(section => {

        section.classList.remove("active");

    });


    const target = document.getElementById(
        "page-" + page
    );


    if (target) {

        target.classList.add("active");

    }


    document.querySelectorAll(
        ".nav button[data-page]"
    ).forEach(button => {

        button.classList.toggle(
            "active",
            button.dataset.page === page
        );

    });


    const crumb = document.getElementById("crumb");

    if (crumb) {

        crumb.textContent = page.toUpperCase();

    }


    const side = document.getElementById("side");

    if (side) {

        side.classList.remove("open");

    }


    // Atualiza gráficos quando uma página é aberta
    setTimeout(() => {

        window.dispatchEvent(
            new Event("resize")
        );

    }, 50);
}


// IMPORTANTE:
// Como o index.html possui onclick="showPage(...)",
// precisamos disponibilizar a função no window.

window.showPage = showPage;


// Eventos do menu

document.querySelectorAll(
    ".nav button[data-page]"
).forEach(button => {

    button.addEventListener("click", () => {

        showPage(button.dataset.page);

    });

});


// ============================================================
// 8. MENU MOBILE
// ============================================================

const hamburger = document.getElementById("hamb");

if (hamburger) {

    hamburger.addEventListener("click", () => {

        const side = document.getElementById("side");

        if (side) {

            side.classList.toggle("open");

        }

    });

}


// ============================================================
// 9. RELÓGIO
// ============================================================

function atualizarRelogio() {

    const clock = document.getElementById("clock");

    if (!clock) {
        return;
    }

    const agora = new Date();

    clock.textContent =
        agora.toLocaleTimeString("pt-BR");

}


atualizarRelogio();

setInterval(
    atualizarRelogio,
    1000
);


// ============================================================
// 10. NORMALIZAÇÃO DOS DADOS
// ============================================================

// O Firebase pode receber os dados em português:
// sensores / robo / gps
//
// Ou no formato em inglês:
// water / robot / gps

function normalizeTelemetry(data) {

    if (!data) {
        return null;
    }


    const sensores =
        data.sensores ||
        data.water ||
        {};


    const robo =
        data.robo ||
        data.robot ||
        {};


    const gps =
        data.gps ||
        {};


    return {

        robot: {

            battery:
                robo.bateria ??
                robo.battery,

            speed:
                robo.velocidade ??
                robo.speed,

            internalTemp:
                robo.temperaturaInterna ??
                robo.internalTemp,

            compartment:
                robo.compartimento ??
                robo.compartment,

            mode:
                robo.modo ??
                robo.mode ??
                "AUTÔNOMO"

        },


        water: {

            temperature:
                sensores.temperatura ??
                sensores.temperature,

            tds:
                sensores.tds,

            turbidityADC:
                sensores.turbidez_adc,

            turbidityVoltage:
                sensores.turbidez_tensao,

            turbidityNTU:
                sensores.turbidez_ntu ??
                sensores.turbidez ??
                sensores.turbidity,

            ph:
                sensores.ph,

            turbidity:
                sensores.turbidez_ntu ??
                sensores.turbidez ??
                sensores.turbidity,

            oxygen:
                sensores.oxigenio ??
                sensores.oxygen,

            conductivity:
                sensores.condutividade ??
                sensores.conductivity,

            orp:
                sensores.orp,

            chlorine:
                sensores.cloro ??
                sensores.chlorine,

            fluoride:
                sensores.fluoreto ??
                sensores.fluoride

        },


        gps: {

            lat:
                gps.latitude ??
                gps.lat,

            lon:
                gps.longitude ??
                gps.lon,

            speed:
                gps.velocidade ??
                gps.speed,

            distance:
                gps.distancia ??
                gps.distance,

            satellites:
                gps.satelites ??
                gps.satellites

        }

    };

}


// ============================================================
// 11. ATUALIZAR INTERFACE
// ============================================================

function updateTelemetry(data) {

    const telemetry =
        normalizeTelemetry(data);


    if (!telemetry) {
        return;
    }


    lastTelemetry = telemetry;


    const robot =
        telemetry.robot || {};

    const water =
        telemetry.water || {};

    const gps =
        telemetry.gps || {};


    // --------------------------------------------------------
    // BATERIA
    // --------------------------------------------------------

    if (robot.battery !== undefined) {

        const battery =
            fmt(robot.battery, 0) + "%";

        setText(
            "batteryValue",
            battery
        );

        setText(
            "robotBattery",
            battery
        );

        setText(
            "topBattery",
            battery
        );

    }


    // --------------------------------------------------------
    // VELOCIDADE
    // --------------------------------------------------------

    const speed =
        robot.speed ??
        gps.speed;


    if (speed !== undefined) {

        const speedText =
            fmt(speed, 1) + " m/s";

        setText(
            "gpsSpeedValue",
            speedText
        );

        setText(
            "mapSpeed",
            speedText
        );

    }


    // --------------------------------------------------------
    // TEMPERATURA INTERNA
    // --------------------------------------------------------

    if (
        robot.internalTemp !== undefined
    ) {

        setText(
            "internalTemp",
            fmt(robot.internalTemp, 1) + " °C"
        );

    }


    // --------------------------------------------------------
    // COMPARTIMENTO
    // --------------------------------------------------------

    if (
        robot.compartment !== undefined
    ) {

        setText(
            "compartmentValue",
            fmt(robot.compartment, 0) + "%"
        );

    }


    // --------------------------------------------------------
    // TEMPERATURA DA ÁGUA
    // --------------------------------------------------------

    if (
        water.temperature !== undefined
    ) {

        const value =
            fmt(water.temperature, 1) + " °C";

        setText(
            "temperatureValue",
            value
        );

        setText(
            "temperatureTableValue",
            value
        );

        setText(
            "temperatureWaterDuplicate",
            value
        );

        atualizarSensorAgua(
            0,
            value
        );

    }


    // --------------------------------------------------------
    // pH
    // --------------------------------------------------------

    if (
        water.ph !== undefined
    ) {

        const value =
            fmt(water.ph, 2);

        setText(
            "phValue",
            value
        );

        setText(
            "phTableValue",
            value
        );

        atualizarSensorAgua(
            1,
            value
        );

    }


    // --------------------------------------------------------
    // TDS
    // --------------------------------------------------------

    if (
        water.tds !== undefined
    ) {

        const value =
            fmt(water.tds, 0) +
            " ppm";

        setText(
            "tdsValue",
            value
        );

        setText(
            "tdsTableValue",
            value
        );

        atualizarSensorAgua(
            3,
            value
        );

    }


    // --------------------------------------------------------
    // TURBIDEZ - ADC
    // --------------------------------------------------------

    if (
        water.turbidityADC !== undefined
    ) {

        setText(
            "turbidityAdcValue",
            fmt(water.turbidityADC, 0)
        );

    }


    // --------------------------------------------------------
    // TURBIDEZ - TENSÃO
    // --------------------------------------------------------

    if (
        water.turbidityVoltage !== undefined
    ) {

        setText(
            "turbidityVoltageValue",
            fmt(water.turbidityVoltage, 3) +
            " V"
        );

        setText(
            "turbidityVoltageTableValue",
            fmt(water.turbidityVoltage, 3) +
            " V"
        );

    }


    // --------------------------------------------------------
    // TURBIDEZ
    // --------------------------------------------------------

    if (
        water.tds !== undefined
    ) {

        history.tds.push(
            Number(water.tds)
        );

        history.tds =
            history.tds.slice(-12);

    }


    if (
        water.turbidity !== undefined
    ) {

        const value =
            fmt(water.turbidity, 1) +
            " NTU";

        setText(
            "turbidityValue",
            value
        );

        setText(
            "turbidityTableValue",
            value
        );

        atualizarSensorAgua(
            2,
            value
        );

    }


    // --------------------------------------------------------
    // OXIGÊNIO
    // --------------------------------------------------------

    if (
        water.oxygen !== undefined
    ) {

        const value =
            fmt(water.oxygen, 1) +
            " mg/L";

        setText(
            "oxygenValue",
            value
        );

        setText(
            "oxygenValue",
            value
        );

    }


    // --------------------------------------------------------
    // CONDUTIVIDADE
    // --------------------------------------------------------

    if (
        water.conductivity !== undefined
    ) {

        const value =
            fmt(water.conductivity, 0) +
            " µS/cm";

        setText(
            "conductivityValue",
            value
        );

        atualizarSensorAgua(
            4,
            value
        );

    }


    // --------------------------------------------------------
    // ORP
    // --------------------------------------------------------

    if (
        water.orp !== undefined
    ) {

        const value =
            fmt(water.orp, 0) +
            " mV";

        setText(
            "orpValue",
            value
        );

        atualizarSensorAgua(
            5,
            value
        );

    }


    // --------------------------------------------------------
    // CLORO
    // --------------------------------------------------------

    if (
        water.chlorine !== undefined
    ) {

        const value =
            fmt(water.chlorine, 2) +
            " mg/L";

        setText(
            "chlorineValue",
            value
        );

        atualizarSensorAgua(
            6,
            value
        );

    }


    // --------------------------------------------------------
    // FLUORETO
    // --------------------------------------------------------

    if (
        water.fluoride !== undefined
    ) {

        const value =
            fmt(water.fluoride, 2) +
            " mg/L";

        setText(
            "fluorideValue",
            value
        );

        atualizarSensorAgua(
            7,
            value
        );

    }
