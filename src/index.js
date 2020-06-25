import "core-js/features/map";
import "core-js/features/set";
import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import VKDataService from "./services/VKDataService"

// Init VK  Mini App
VKDataService.Init();

ReactDOM.render(<App />, document.getElementById("root"));
if (process.env.NODE_ENV === "development") {
  import("./eruda").then(({ default: eruda }) => {}); //runtime download
}
