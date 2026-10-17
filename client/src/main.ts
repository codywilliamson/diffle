import { mount } from "svelte";
import App from "./App.svelte";
import "./app.css";
import { connectPresence } from "$lib/api/presence";

const target = document.getElementById("app");
if (!target) throw new Error("missing #app mount point");

connectPresence();

export default mount(App, { target });
