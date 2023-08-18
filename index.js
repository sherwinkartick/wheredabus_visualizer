const { Map } = await google.maps.importLibrary("maps");
const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");

let gmap;

// The location of TTC stop
const stop_location = { "lat": 43.64657, "lng": -79.4067199 };
let stop_marker;

let stop_colours = []
let direction_colours = [];
const routes = ["7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "19", "20", "21", "22", "23", "24", "25", "26", "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "47", "48", "49", "50", "51", "52", "53", "54", "55", "56", "57", "59", "60", "61", "62", "63", "64", "65", "66", "67", "68", "69", "70", "71", "72", "73", "74", "75", "76", "77", "78", "79", "80", "81", "82", "83", "84", "85", "86", "87", "88", "89", "90", "91", "92", "93", "94", "95", "96", "97", "98", "99", "100", "101", "102", "104", "105", "106", "107", "108", "109", "110", "111", "112", "113", "115", "116", "118", "119", "120", "121", "122", "123", "124", "125", "126", "127", "128", "129", "130", "131", "132", "133", "134", "135", "160", "161", "162", "165", "167", "168", "169", "171", "176", "184", "189", "200", "201", "202", "203", "300", "301", "302", "304", "306", "307", "310", "312", "315", "320", "322", "324", "325", "329", "332", "334", "335", "336", "337", "339", "341", "343", "352", "353", "354", "363", "365", "384", "385", "395", "396", "501", "503", "504", "505", "506", "509", "510", "511", "512", "900", "902", "905", "924", "925", "927", "929", "935", "937", "939", "941", "944", "945", "952", "953", "954", "960", "968", "984", "985", "986", "989", "995", "996"]

const location_markers = {};
const info_windows = {};
const stop_markers = {};
const id_time = {};

let fetchDataIntervalId;
let updateInfoWindowsIntervalId;
let isIntervalRunning = false; // Track if the interval is running

async function initMap() {
    gmap = new google.maps.Map(document.getElementById("map"), {
        center: stop_location,
        zoom: 13,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        rotateControl: true,
        mapId: "cf811fefe256b068"
    });
}

function parseLocations() {
    const json_ta = document.getElementById('json_ta').value;
    const lines = json_ta.trim().split('\n');
    const vlss = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line !== '') {
            try {
                const vls = JSON.parse(line);
                vlss.push(vls);
            } catch (error) {
                console.error('Error parsing JSON:', error);
            }
        }
    }
    document.getElementById('status').textContent = "Location Length: " + vlss.length;
    return vlss;
}

function parseStops() {
    const json_ta = document.getElementById('json_ta').value;
    const lines = json_ta.trim().split('\n');
    const stops = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line !== '') {
            try {
                let stop = JSON.parse(line);
                stops.push(stop);
            } catch (error) {
                console.error('Error parsing JSON:', error);
            }
        }
    }
    document.getElementById('status').textContent = "Stops Length: " + stops.length;
    return stops;
}

function isInfoWindowOpen(infoWindow) {
    let map = infoWindow.map;
    return (map !== null && typeof map !== "undefined");
}

function getBackground(route) {
    // const color1 = ["#ea5545", "#f46a9b", "#ef9b20", "#edbf33", "#ede15b", "#bdcf32", "#87bc45", "#27aeef", "#b33dc6"];
    const color2 = ["#e60049", "#0bb4ff", "#50e991", "#e6d800", "#9b19f5", "#ffa300", "#dc0ab4", "#b3d4ff", "#00bfa0"];
    // const color3 = ["#b30000", "#7c1158", "#4421af", "#1a53ff", "#0d88e6", "#00b7c7", "#5ad45a", "#8be04e", "#ebdc78"];
    const color4 = ["#fd7f6f", "#7eb0d5", "#b2e061", "#bd7ebe", "#ffb55a", "#ffee65", "#beb9db", "#fdcce5", "#8bd3c7"];

    const combinedColors = [];

    while (combinedColors.length < direction_colours.length) {
        combinedColors.push(...color2, ...color4);
    }

    // const colours = ["#fd7f6f", "#7eb0d5", "#b2e061", "#bd7ebe", "#ffb55a", "#ffee65", "#beb9db", "#fdcce5", "#8bd3c7", 
    // "#ea5545", "#f46a9b", "#ef9b20", "#edbf33", "#ede15b", "#bdcf32", "#87bc45", "#27aeef", "#b33dc6"];
    return combinedColors[direction_colours.indexOf(route)]
}

function updateLocations(vlss) {
    const ts = new Date();
    document.getElementById('status').textContent = "Updating at " + ts.toLocaleString();

    const items = []
    for (let vls of vlss) {
        items.push(`${vls.routeTag} ${vls.dirName}`)
    }
    direction_colours = [...new Set(items)]
    direction_colours.sort()
    document.getElementById('status').textContent = 'VLS: ' + vlss.length + ' Direction colours:' + direction_colours.length;

    outer: for (let key in location_markers) {
        for (let vls of vlss) {
            if (key == vls.id) {
                continue outer;
            }
        }
        location_markers[key].position = null;
        delete location_markers[key];
        delete info_windows[key];
        delete id_time[key];
    }

    for (let vls of vlss) {
        // fast skip things that didn't change
        if (vls.id in id_time) {
            if (vls.time == id_time[vls.id]) {
                continue;
            }
        }
        id_time[vls.id] = vls.time;
    
        const glyphImg = document.createElement("img");
        glyphImg.src = "arrow-up.svg";
        glyphImg.style.transform = `rotate(${vls.heading}deg)`;
        let background = getBackground(`${vls.routeTag} ${vls.dirName}`)
        const glyphSvgPinElement = new PinElement({
            glyph: glyphImg,
            background: background,
            borderColor: '#FFFFFF',
            scale: 0.5
        });
        const currentTimeInSeconds = Math.floor(Date.now() / 1000);
        const timeDelta = currentTimeInSeconds - vls.time;
        const contentString = `
                <div>
                    <div><span class="attribute-label">Update Time:</span> <span class="attribute-value">${ts.toLocaleString()}</span></div>
                    <div><span class="attribute-label">ID:</span> <span class="attribute-value">${vls.id}</span></div>
                    <div><span class="attribute-label">Route:</span> <span class="attribute-value">${vls.routeTag}</span></div>
                    <div><span class="attribute-label">Direction Tag:</span> <span class="attribute-value">${vls.dirTag}</span></div>
                    <div><span class="attribute-label">Direction Name:</span> <span class="attribute-value">${vls.dirName}</span></div>
                    <div><span class="attribute-label">Heading:</span> <span class="attribute-value">${vls.heading}</span></div>
                    <div><span class="attribute-label">Speed:</span> <span class="attribute-value">${vls.speed}</span></div>
                    <div><span class="attribute-label">Report Age:</span> <span class="attribute-value" id=infowindow_time_${vls.id}>${timeDelta}</span></div>
                </div>`;
        if (!(vls.id in location_markers)) {
            const marker = new AdvancedMarkerElement({
                map: gmap,
                position: vls,
                content: glyphSvgPinElement.element,
                title: vls.id
            });
            const infowindow = new google.maps.InfoWindow({
                content: contentString,
            });
            marker.addEventListener("gmp-click", () => {
                infowindow.open({
                    anchor: marker,
                    gmap,
                });
            });
            location_markers[vls.id] = marker;
            info_windows[vls.id] = infowindow;
        } else {
            const marker = location_markers[vls.id];
            marker.position = vls;
            marker.content = glyphSvgPinElement.element;
            const infowindow = info_windows[vls.id];
            infowindow.setContent(contentString);
        }
    }
}


function loadStops(stops) {
    const items = []
    for (let stop of stops) {
        items.push(`${stop.routeTag} ${stop.dirName}`)
    }
    stop_colours = [...new Set(items)]
    stop_colours.sort()

    for (let stop of stops) {
        let background = getBackground(`${stop.routeTag} ${stop.dirName}`)
        const pin = new PinElement({
            background: background,
            borderColor: "#FF0F00",
            glyphColor: "#FF0F00",
            scale: 0.5
        });
        stop_marker = new AdvancedMarkerElement({
            map: gmap,
            position: stop,
            content: pin.element,
            title: `${stop.tag} - ${stop.routeTag} ${stop.dirName} - ${stop.title}`,
        });
        stop_markers[stop.tag] = stop_marker;
    }

}

function clearLocations() {
    for (const key in location_markers) {
        const location_marker = location_markers[key];
        location_marker.position = null;
        delete location_markers[key];
        delete info_windows[key]
    }
}

function clearStops() {
    for (const key in stop_markers) {
        const stop_marker = stop_markers[key];
        stop_marker.position = null;
        delete stop_markers[key];
    }
}

function fetchData() {
    fetch('http://192.168.1.204:5000/routes/locations', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(routes),
    })
        .then(response => response.json())
        .then(vlss => {
            updateLocations(vlss)
        })
        .catch(error => {
            document.getElementById('status').textContent = 'Error fetching data:' + error;
            console.error('Error fetching data:', error);
            toggleRefresh()
        });
}

function updateInfoWindows() {
    for (let key in info_windows) {
        const info_window = info_windows[key]
        const span = document.getElementById(`infowindow_time_${key}`);
        if (span != null) {
            span.textContent = parseInt(span.textContent) + 1;
        }
    }
}

function initControls() {
    document.getElementById('resetViewButton').addEventListener("click", () => {
        gmap.setCenter(stop_location);
    });

    // document.getElementById('loadLocationsButton').addEventListener("click", () => {
    //     let vlss = parseLocations();
    //     updateLocations(vlss);
    // });

    // document.getElementById('clearLocationsButton').addEventListener("click", () => {
    //     clearLocations();
    // });

    // document.getElementById('loadStopsButton').addEventListener("click", () => {
    //     let stops = parseStops();
    //     loadStops(stops);
    // });

    // document.getElementById('clearStopsButton').addEventListener("click", () => {
    //     clearStops();
    // });
}

function initStops() {
}

function initUpdating() {
    fetchData();
    const toggleRefreshButton = document.getElementById('toggleRefreshButton');
    toggleRefreshButton.addEventListener('click', () => {
        toggleRefresh();
    });
    toggleRefresh()
}

function toggleRefresh() {
    const toggleRefreshButton = document.getElementById('toggleRefreshButton');
    if (!isIntervalRunning) {
        // Start the interval and update button text
        fetchDataIntervalId = setInterval(fetchData, 10000);
        updateInfoWindowsIntervalId = setInterval(updateInfoWindows, 1000)
        toggleRefreshButton.textContent = 'Stop Refreshing';
    } else {
        clearInterval(fetchDataIntervalId);
        clearInterval(updateInfoWindowsIntervalId);
        toggleRefreshButton.textContent = 'Start Refreshing';
    }

    // Toggle the interval running state
    isIntervalRunning = !isIntervalRunning;
}


initMap();
initControls();
initStops();
initUpdating();


