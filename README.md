# Wheredabus Visualizer

This repository contains the Web UI for Wheredabus Visualizer, a debugging tool for the Wheredabus project.

## Features

- See physical stops on a Google map given a specific location
-- stops are colour coded according to routes they service
- currently only stops along streetcar routes are shown due to rate-limiting by NextBus
- select a stop, select a route the stop services, see vehicles on route, select a vehicle


## Future Improvements

- See route disruptions real-time, and accurate estimated arrival times

## Usage
- Open `index.html` in your web browser to use the visualizer. https://queenwest.web.me/index.html
-- It's look terrible on a phone, you've been warned, use a desktop

## Notes
- The server is not running most of the time, so you have to reach out to me to ensure it's up.
-- See [here](https://github.com/sherwinkartick/didimissdabus) for python server.
-- It runs on my home desktop, and uses Caddy to expose an https endpoint to the static files and python backend
-- It's look terrible on a phone, you've been warned
-- Yes, I could have run it on a cloud, but I'm cheap and home desktop is free since I keep it on all the time. (Hmm, that seems contradictory, oh well)
- Google Maps API costs money, so I'll never make it public, plus this is a debugging tool

## License
This project is licensed under the [MIT License](LICENSE).