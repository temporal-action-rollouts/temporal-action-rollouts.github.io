"use strict";

const tasks = [...document.querySelectorAll(".task:not([data-multiview])")];

for (const task of tasks) {
  const videos = [...task.querySelectorAll("video")];
  const actions = task.querySelector(".pair-actions");
  const button = actions.querySelector("button");
  const label = button.querySelector("span");
  const rate = actions.querySelector("select");
  const status = actions.querySelector("[role=status]");
  const playing = () => videos.some(video => !video.paused && !video.ended);
  const updateButton = () => {
    label.textContent = playing() ? "Pause both" : "Play both";
  };
  actions.hidden = false;
  for (const video of videos) {
    for (const event of ["play", "pause", "ended"]) {
      video.addEventListener(event, updateButton);
    }
  }
  rate.addEventListener("change", () => {
    for (const video of videos) video.playbackRate = Number(rate.value);
  });
  button.addEventListener("click", async () => {
    if (playing()) {
      videos.forEach(video => video.pause());
      return;
    }
    status.textContent = "";
    const restart = videos.some(video => video.ended);
    const settled = await Promise.allSettled(videos.map(video => {
      if (restart) video.currentTime = 0;
      video.playbackRate = Number(rate.value);
      return video.play();
    }));
    if (settled.some(outcome => outcome.status === "rejected")) {
      status.textContent = "Use the video controls if a clip did not start.";
    }
    updateButton();
  });
}

function markTask() {
  for (const link of document.querySelectorAll(".task-nav a, .section-nav a, .motion-nav a")) {
    if (link.hash === location.hash) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
}
window.addEventListener("hashchange", markTask);
markTask();

// Camera views share one rollout timeline. Native controls remain available.
for (const task of document.querySelectorAll("[data-multiview]")) {
  const videos = [...task.querySelectorAll("video")];
  const actions = task.querySelector(".pair-actions");
  const button = actions.querySelector(".play-pair");
  const label = button.querySelector("span");
  const restart = actions.querySelector(".restart-views");
  const rate = actions.querySelector("select");
  const status = actions.querySelector("[role=status]");
  let active = false;
  let frame = 0;
  let anchor = videos[0];
  const update = () => { label.textContent = active ? "Pause all views" : "Play all views"; };
  const seek = (video, time) => {
    const limit = Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.03) : time;
    const target = Math.min(time, limit);
    if (Math.abs(video.currentTime - target) > 0.12) video.currentTime = target;
  };
  const pause = () => {
    active = false;
    cancelAnimationFrame(frame);
    videos.forEach(video => video.pause());
    update();
  };
  const keepTogether = () => {
    if (!active) return;
    if (!anchor.seeking && anchor.readyState >= 3) {
      for (const video of videos) {
        if (video !== anchor && !video.seeking && video.readyState >= 3 &&
            Math.abs(video.currentTime - anchor.currentTime) > 0.25) seek(video, anchor.currentTime);
      }
    }
    frame = requestAnimationFrame(keepTogether);
  };
  const play = async (source = videos[0], fromStart = false) => {
    anchor = source;
    const time = fromStart || videos.some(video => video.ended) ? 0 : source.currentTime;
    active = true;
    status.textContent = "";
    cancelAnimationFrame(frame);
    update();
    const settled = await Promise.allSettled(videos.map(video => {
      seek(video, time);
      video.playbackRate = Number(rate.value);
      return video.play();
    }));
    if (settled.some(result => result.status === "rejected") && active) {
      pause();
      status.textContent = "A view could not start. Try Play all views again, or open the video directly.";
    }
    if (active) frame = requestAnimationFrame(keepTogether);
  };
  actions.hidden = false;
  button.addEventListener("click", () => active ? pause() : play(anchor));
  restart.addEventListener("click", () => play(videos[0], true));
  rate.addEventListener("change", () => {
    videos.forEach(video => { video.playbackRate = Number(rate.value); });
  });
  for (const video of videos) {
    video.addEventListener("play", () => { if (!active) play(video); });
    video.addEventListener("pause", () => { if (active && !video.seeking) pause(); });
    video.addEventListener("ended", pause);
    video.addEventListener("seeking", () => {
      if (videos.every(other => other === video || Math.abs(other.currentTime - video.currentTime) <= 0.12)) return;
      anchor = video;
      videos.forEach(other => { if (other !== video) seek(other, video.currentTime); });
    });
    video.addEventListener("error", () => {
      pause();
      status.textContent = "A camera view could not load. Reload the page or open the video directly.";
    });
  }
}
