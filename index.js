
const { Map } = await google.maps.importLibrary("maps");
const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");

let gmap;

// The location of TTC stop
const stop_location = {"lat": 43.64657, "lng": -79.4067199 };
let stop_marker;

let location_markers = [];

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
    var ts = new Date();
    document.getElementById('status').textContent = "Displaying at " + ts.toLocaleString();

    for (let vls of vlss) {
        let pin;

        const glyphImg = document.createElement("img");
        glyphImg.src = "arrow-up2.svg";
        glyphImg.style.transform = `rotate(${vls.heading}deg)`;
        const glyphSvgPinElement = new PinElement({
            glyph: glyphImg,
            background: "#0000FF",
            borderColor: "#FF0F00",
            glyphColor: "#FF0F00",
        });

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
                background: "#0000FF",
                borderColor: "#FF0F00",
                glyphColor: "#FF0F00",
                scale: 1.0
              });
        }
        const location_marker = new AdvancedMarkerElement({
            map: gmap,
            position: vls,
            content: glyphSvgPinElement.element,
            title: vls.id,
        });
        const currentTimeInSeconds = Math.floor(Date.now() / 1000);
        const timeDelta = currentTimeInSeconds - vls.time;
        const contentString = `
        <div class="json-card-content">
            <div><span class="attribute-label">ID:</span> <span class="attribute-value">${vls.id}</span></div>
            <div><span class="attribute-label">Route:</span> <span class="attribute-value">${vls.routeTag}</span></div>
            <div><span class="attribute-label">Direction:</span> <span class="attribute-value">${vls.dirTag}</span></div>
            <div><span class="attribute-label">Heading:</span> <span class="attribute-value">${vls.heading}</span></div>
            <div><span class="attribute-label">Speed:</span> <span class="attribute-value">${vls.speed}</span></div>
            <div><span class="attribute-label">Time:</span> <span class="attribute-value">${timeDelta}</span></div>
        </div>`;

        const infowindow = new google.maps.InfoWindow({
            content: contentString,
        });
        location_marker.addEventListener("gmp-click", () => {
            infowindow.open({
                anchor: location_marker,
                gmap,
            });
        });
        location_markers.push(location_marker)
    }
}

function isInfoWindowOpen(infoWindow){
    let map = infoWindow.getMap();
    return (map !== null && typeof map !== "undefined");
}

function updateLocations(vlss) {

    var ts = new Date();
    document.getElementById('status').textContent = "Updating at " + ts.toLocaleString();

    let openedWindows = []

    //close all the info-windows
    // for (let marker of location_markers) {
    //     if (isInfoWindowOpen(marker.infoWindow)) {
    //         openedWindows.push(marker.title) //dangerous hiding meta data in title
    //         marker.infoWindow.close()
    //     }
    // }

    const new_location_markers = []
    outer: for (let marker of location_markers) {
        for (let vls of vlss) {
            if (marker.title == vls.id) {
                new_location_markers.push(marker)
                continue outer;
            }
        }
        //not there, so delete it
        marker.position = null;
    }
    location_markers = new_location_markers;

    for (let vls of vlss) {
        let markerToUpdate = null;
        for (let marker of location_markers) {
            if (marker.title == vls.id) {
                markerToUpdate = marker;
            }
        }

        if (markerToUpdate == null) {
            const glyphImg = document.createElement("img");
            glyphImg.src = "arrow-up2.svg";
            glyphImg.style.transform = `rotate(${vls.heading}deg)`;
            const glyphSvgPinElement = new PinElement({
                glyph: glyphImg,
                background: "#0000FF",
                borderColor: "#FF0F00",
                glyphColor: "#FF0F00",
            });
            markerToUpdate = new AdvancedMarkerElement({
                map: gmap,
                position: vls,
                content: glyphSvgPinElement.element,
                title: vls.id,
            });
            const currentTimeInSeconds = Math.floor(Date.now() / 1000);
            const timeDelta = currentTimeInSeconds - vls.time;
            const contentString = `
            <div class="json-card-content">
                <div><span class="attribute-label">ID:</span> <span class="attribute-value">${vls.id}</span></div>
                <div><span class="attribute-label">Route:</span> <span class="attribute-value">${vls.routeTag}</span></div>
                <div><span class="attribute-label">Direction:</span> <span class="attribute-value">${vls.dirTag}</span></div>
                <div><span class="attribute-label">Heading:</span> <span class="attribute-value">${vls.heading}</span></div>
                <div><span class="attribute-label">Speed:</span> <span class="attribute-value">${vls.speed}</span></div>
                <div><span class="attribute-label">Time:</span> <span class="attribute-value">${timeDelta}</span></div>
            </div>`;
    
            const infowindow = new google.maps.InfoWindow({
                content: contentString,
            });
            markerToUpdate.addEventListener("gmp-click", () => {
                infowindow.open({
                    anchor: markerToUpdate,
                    gmap,
                });
            });
            location_markers.push(markerToUpdate)
        } else {
            const glyphImg = document.createElement("img");
            glyphImg.src = "arrow-up2.svg";
            glyphImg.style.transform = `rotate(${vls.heading}deg)`;
            const glyphSvgPinElement = new PinElement({
                glyph: glyphImg,
                background: "#0000FF",
                borderColor: "#FF0F00",
                glyphColor: "#FF0F00",
            });
            markerToUpdate.content = glyphSvgPinElement.element;
            markerToUpdate.setPosition(vls);

            const currentTimeInSeconds = Math.floor(Date.now() / 1000);
            const timeDelta = currentTimeInSeconds - vls.time;
            const contentString = `
            <div class="json-card-content">
                <div><span class="attribute-label">ID:</span> <span class="attribute-value">${vls.id}</span></div>
                <div><span class="attribute-label">Route:</span> <span class="attribute-value">${vls.routeTag}</span></div>
                <div><span class="attribute-label">Direction:</span> <span class="attribute-value">${vls.dirTag}</span></div>
                <div><span class="attribute-label">Heading:</span> <span class="attribute-value">${vls.heading}</span></div>
                <div><span class="attribute-label">Speed:</span> <span class="attribute-value">${vls.speed}</span></div>
                <div><span class="attribute-label">Time:</span> <span class="attribute-value">${timeDelta}</span></div>
            </div>`;
    
            // const infowindow = new google.maps.InfoWindow({
            //     content: contentString,
            // });
            // markerToUpdate.addEventListener("gmp-click", () => {
            //     infowindow.open({
            //         anchor: markerToUpdate,
            //         gmap,
            //     });
            // });
        }
    }

}

function clearLocations() {
    for (let location_marker of location_markers) {
        location_marker.position = null;
    }
    location_markers.length = 0;
}

function fetchData() {
    fetch('http://127.0.0.1:5000/locations/501')
        .then(response => response.json())
        .then(vlss => {
            clearLocations()
            displayLocations(vlss)
        })
        .catch(error => {
            console.error('Error fetching data:', error);
        });
}

function initUpdating() {
    // Initial fetch
    fetchData();

    // Fetch data every 15 seconds
    setInterval(fetchData, 15000); // 15000 milliseconds = 15 seconds
}

initMap();
initUpdating();


