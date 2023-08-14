
const { Map } = await google.maps.importLibrary("maps");
const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");

let gmap;

// The location of TTC stop
const stop_location = {"lat": 43.64657, "lng": -79.4067199 };
let stop_marker;

const routes = ["501", "511"];

const location_markers = {};
const info_windows = {};
const stop_markers = {};

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


function isInfoWindowOpen(infoWindow){
    let map = infoWindow.map;
    return (map !== null && typeof map !== "undefined");
}

function getBackground(route) {
    const colours = ["#fd7f6f", "#7eb0d5", "#b2e061", "#bd7ebe", "#ffb55a", "#ffee65", "#beb9db", "#fdcce5", "#8bd3c7"];
    return colours[routes.indexOf(route)]
}

function updateLocations(vlss) {
    const ts = new Date();
    document.getElementById('status').textContent = "Updating at " + ts.toLocaleString();

    outer: for (let key in location_markers) {
        for (let vls of vlss) {
            if (key == vls.id) {
                continue outer;
            }
        }
        location_markers[key].position = null;
        delete location_markers[key];
        delete info_windows[key];
    }

    for (let vls of vlss) {
        const glyphImg = document.createElement("img");
        glyphImg.src = "arrow-up.svg";
        glyphImg.style.transform = `rotate(${vls.heading}deg)`;
        let background = getBackground(vls.routeTag)
        const glyphSvgPinElement = new PinElement({
            glyph: glyphImg,
            background: background,
            borderColor: '#FFFFFF'
        });
        const currentTimeInSeconds = Math.floor(Date.now() / 1000);
        const timeDelta = currentTimeInSeconds - vls.time;
        const contentString = `
        <div>
            <div><span class="attribute-label">Update Time:</span> <span class="attribute-value">${ ts.toLocaleString()}</span></div>
            <div><span class="attribute-label">ID:</span> <span class="attribute-value">${vls.id}</span></div>
            <div><span class="attribute-label">Route:</span> <span class="attribute-value">${vls.routeTag}</span></div>
            <div><span class="attribute-label">Direction:</span> <span class="attribute-value">${vls.dirTag}</span></div>
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
    for (let stop of stops) {
        const pinYellow = new PinElement({
            background: "#FFFF00",
            borderColor: "#FF0F00",
            glyphColor: "#FF0F00",
            scale: 0.5
          });
        stop_marker = new AdvancedMarkerElement({
            map: gmap,
            position: stop,
            content: pinYellow.element,
            title: stop.title,
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
    fetch('http://127.0.0.1:5000/routes/locations', {
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
    // //Yellow stop is the stop of interest
    // const pinYellow = new PinElement({
    //     background: "#FFFF00",
    //     borderColor: "#FF0F00",
    //     glyphColor: "#FF0F00",
    //     scale: 1.0
    //   });

    // // The marker, positioned at TTC stop
    // stop_marker = new AdvancedMarkerElement({
    //     map: gmap,
    //     position: stop_location,
    //     content: pinYellow.element,
    //     title: "TTC Stop",
    // });

    document.getElementById('resetViewButton').addEventListener("click", () => {
        gmap.setCenter(stop_location);
    });

    document.getElementById('loadLocationsButton').addEventListener("click", () => {
        let vlss = parseLocations();
        updateLocations(vlss);
    });

    document.getElementById('clearLocationsButton').addEventListener("click", () => {
        clearLocations();
    });

    document.getElementById('loadStopsButton').addEventListener("click", () => {
        let stops = parseStops();
        loadStops(stops);
    });

    document.getElementById('clearStopsButton').addEventListener("click", () => {
        clearStops();
    });
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


