import "colors";

export function log(...args: any[]) {
  console.log(new Date().toLocaleString().gray, "Info:".blue, ...args);
}

export function http(...args: any[]) {
  console.log(new Date().toLocaleString().gray, "Http:".green, ...args);
}

export function error(...args: any[]) {
  console.error(new Date().toLocaleString().gray, "Error:".red, ...args);
}

export function warn(...args: any[]) {
  console.warn(new Date().toLocaleString().gray, "Warn:".yellow, ...args);
}

export function debug(...args: any[]) {
  console.warn(new Date().toLocaleString().gray, "Debug:".magenta, ...args);
}