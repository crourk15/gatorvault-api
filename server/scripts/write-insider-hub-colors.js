const fs = require("fs");
const path = require("path");
const css = fs.readFileSync(path.join(__dirname, "insider-hub-colors.css.txt"), "utf8");
const target = path.join(__dirname, "../../client/lib/insider-hub.css");
fs.writeFileSync(target, css, "utf8");
console.log("Wrote", target);