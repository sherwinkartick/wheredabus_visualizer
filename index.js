
const { Map } = await google.maps.importLibrary("maps");
const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");

let gmap;

// The location of TTC stop
const stop_location = {"lat": 43.64657, "lng": -79.4067199 };
let stop_marker;

const location_markers = [];

let vehicle_location_map;

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

    //Yellow stop is the stop of interest
    const pinYellow = new PinElement({
        background: "#FFFF00",
        borderColor: "#FF0F00",
        glyphColor: "#FF0F00",
        scale: 1.0
      });

    // The marker, positioned at TTC stop
    stop_marker = new AdvancedMarkerElement({
        map: gmap,
        position: stop_location,
        content: pinYellow.element,
        title: "TTC Stop",
    });

    document.getElementById('resetViewButton').addEventListener("click", () => {
        gmap.setCenter(stop_location);
    });

    document.getElementById('plotLocationsButton').addEventListener("click", () => {
        let vlss = parseLocations();
        displayLocations(vlss);
    });

    document.getElementById('clearLocationsButton').addEventListener("click", () => {
        clearLocations();
    });
}

function parseLocations() {
    var json_ta = document.getElementById('json_ta').value;
    var lines = json_ta.trim().split('\n');
    var vlss = [];
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line !== '') {
            try {
                var vls = JSON.parse(line);
                vlss.push(vls);
            } catch (error) {
                console.error('Error parsing JSON:', error);
            }
        }
    }

    // Display the parsed objects
    document.getElementById('status').textContent = "Length: " + vlss.length;
    return vlss;
}

function displayLocations(vlss) {
    for (let vls of vlss) {
        let pin;
        if (vls.state == "before") {
            pin = new PinElement({
                background: "#00FF00",
                borderColor: "#FF0F00",
                glyphColor: "#FF0F00",
                scale: 1.0
              });
        } else if (vls.state == "after")  {
            pin = new PinElement({
                background: "#0000FF",
                borderColor: "#FF0F00",
                glyphColor: "#FF0F00",
                scale: 1.0
              });
        } else {
            pin = new PinElement({
                background: "#0F0000",
                borderColor: "#FF0F00",
                glyphColor: "#FF0F00",
                scale: 1.0
              });
        }
        const location_marker = new AdvancedMarkerElement({
            map: gmap,
            position: vls,
            content: pin.element,
            title: vls.id,
        });
        location_markers.push(location_marker)
    }
}

function clearLocations() {
    for (let location_marker of location_markers) {
        location_marker.position = null;
    }
    location_markers.length = 0;
}

initMap();


