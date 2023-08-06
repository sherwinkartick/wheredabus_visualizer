let map;
let marker_position;
let vehicle_location_map;

// The location of TTC stop
const stop_location = {"lat": 43.64657, "lng": -79.4067199 };
const vehicle_location_array = []

function initLocations() {

    const loc1 = {lat: 43.655031, lng: -79.3866512};
    const loc2 = {lat: 43.6550851, lng: -79.3863838};
    const loc3 = {lat: 43.6554829, lng: -79.3844903};
    const loc4 = {lat: 43.6555824, lng: -79.3840103};;

    const vehicle_location_array = []
    vehicle_location_array.push(loc1)
    vehicle_location_array.push(loc2)
    vehicle_location_array.push(loc3)
    vehicle_location_array.push(loc4)

    marker_position = stop_location;
}

async function initMap() {

    const { Map } = await google.maps.importLibrary("maps");
    const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");

    map = new google.maps.Map(document.getElementById("map"), {
        center: stop_location,
        zoom: 16,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        rotateControl: true,
        mapId: "cf811fefe256b068"
    });

    const parser = new DOMParser();
    const pinSvgString =
        '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56" fill="none"><rect width="56" height="56" rx="28" fill="#7837FF"></rect><path d="M46.0675 22.1319L44.0601 22.7843" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M11.9402 33.2201L9.93262 33.8723" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M27.9999 47.0046V44.8933" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M27.9999 9V11.1113" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M39.1583 43.3597L37.9186 41.6532" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M16.8419 12.6442L18.0816 14.3506" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M9.93262 22.1319L11.9402 22.7843" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M46.0676 33.8724L44.0601 33.2201" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M39.1583 12.6442L37.9186 14.3506" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M16.8419 43.3597L18.0816 41.6532" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M28 39L26.8725 37.9904C24.9292 36.226 23.325 34.7026 22.06 33.4202C20.795 32.1378 19.7867 30.9918 19.035 29.9823C18.2833 28.9727 17.7562 28.0587 17.4537 27.2401C17.1512 26.4216 17 25.5939 17 24.7572C17 23.1201 17.5546 21.7513 18.6638 20.6508C19.7729 19.5502 21.1433 19 22.775 19C23.82 19 24.7871 19.2456 25.6762 19.7367C26.5654 20.2278 27.34 20.9372 28 21.8649C28.77 20.8827 29.5858 20.1596 30.4475 19.6958C31.3092 19.2319 32.235 19 33.225 19C34.8567 19 36.2271 19.5502 37.3362 20.6508C38.4454 21.7513 39 23.1201 39 24.7572C39 25.5939 38.8488 26.4216 38.5463 27.2401C38.2438 28.0587 37.7167 28.9727 36.965 29.9823C36.2133 30.9918 35.205 32.1378 33.94 33.4202C32.675 34.7026 31.0708 36.226 29.1275 37.9904L28 39Z" fill="#FF7878"></path></svg>';
    const pinSvgString2 = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect x="0" y="0" width="10" height="10" style="fill:blue;stroke:pink;stroke-width:2;fill-opacity:0.1;stroke-opacity:1"/></svg>'
    const pinSvg = parser.parseFromString(
        pinSvgString2,
        "image/svg+xml",
    ).documentElement;

    const pinSvg2 = document.getElementById("svg_icon"); //It will disappear if used by maps api!

    const glyphImg = document.createElement("img");
    glyphImg.src = "left.svg";
    glyphImg.style.transform = 'rotate(180deg)';
    const glyphSvgPinElement = new PinElement({
        glyph: glyphImg,
    });

    const pinYellow = new PinElement({
        background: "#FFFF00",
        borderColor: "#FF0F00",
        glyphColor: "#FF0F00",
        scale: 1.0
      });

    // The marker, positioned at TTC stop
    const marker = new AdvancedMarkerElement({
        map: map,
        position: marker_position,
        /* content: glyphSvgPinElement.element, */
        content: pinYellow.element,
        title: "TTC Stop",
    });

    // Apply new JSON when the user chooses to hide/show features.
    document.getElementById("hide-poi").addEventListener("click", () => {
        marker.position = null;
    });
    document.getElementById("show-poi").addEventListener("click", () => {
        marker.position = marker_position;
    });

    document.getElementById('resetViewButton').addEventListener("click", () => {
        map.setCenter(stop_location);
    });

}

initLocations();
initMap();


