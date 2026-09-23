// Registers the CSS-module hook for the node test lane (`node --import`).
import { register } from 'node:module'

register('./css-hooks.mjs', import.meta.url)
