import { SCORE, scoreUrl } from "./score.js?v=17";

const audio = document.getElementById("score-audio");
const playing = document.getElementById("playing-track");
const library = document.getElementById("score-library");
let current;
const tracks = [];

function select(track) {
  current?.button.removeAttribute("aria-current");
  current = track;
  track.button.setAttribute("aria-current", "true");
  playing.textContent = track.title;
  audio.src = track.url;
}

for (const group of SCORE) {
  const section = document.createElement("section");
  const heading = document.createElement("h2");
  const list = document.createElement("ol");
  heading.textContent = group.title;
  for (const [key, title] of group.tracks) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    const download = document.createElement("a");
    const url = scoreUrl(key);
    const track = { title, url, button };
    tracks.push(track);
    button.type = "button";
    button.textContent = title;
    button.addEventListener("click", () => {
      if (current !== track) select(track);
      audio.play().catch(() => {});
    });
    download.href = url;
    download.download = "Проклятие фортуны — " + title + ".mp3";
    download.textContent = "MP3 ↓";
    download.setAttribute("aria-label", "Скачать «" + title + "» в MP3");
    item.append(button, download);
    list.append(item);
  }
  section.append(heading, list);
  library.append(section);
}
select(tracks[0]);

audio.addEventListener("ended", () => {
  const next = tracks[tracks.indexOf(current) + 1];
  if (!next) return;
  select(next);
  audio.play().catch(() => {});
});
