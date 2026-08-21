(() => {
  const $ = (sel) => document.querySelector(sel);

  const tabs = document.querySelectorAll(".tab");
  const tabPanels = {
    single: $("#tab-single"),
    bulk: $("#tab-bulk"),
  };
  const singleUrlInput = $("#single-url");
  const bulkUrlsInput = $("#bulk-urls");
  const fileInput = $("#file-input");
  const fileBrowseBtn = $("#file-browse");
  const fileDrop = $("#file-drop");
  const qualitySelect = $("#quality");
  const outputDirInput = $("#output-dir");
  const cookiesSelect = $("#cookies-browser");
  const downloadBtn = $("#download-btn");
  const cancelBtn = $("#cancel-btn");
  const formError = $("#form-error");

  const queueEmpty = $("#queue-empty");
  const queueList = $("#queue-list");

  const libraryEmpty = $("#library-empty");
  const libraryList = $("#library-list");
  const openFolderBtn = $("#open-folder-btn");
  const refreshLibraryBtn = $("#refresh-library-btn");

  const toastEl = $("#toast");

  let activeTab = "single";
  let currentJobId = null;
  let pollTimer = null;

  // ---- Tabs ----------------------------------------------------------
  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      tabs.forEach((b) => b.classList.toggle("active", b === btn));
      Object.entries(tabPanels).forEach(([key, el]) => el.classList.toggle("hidden", key !== activeTab));
    });
  });

  // ---- Bulk file loading ----------------------------------------------
  function loadFileIntoTextarea(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const existing = bulkUrlsInput.value.trim();
      const incoming = String(reader.result).trim();
      bulkUrlsInput.value = existing ? existing + "\n" + incoming : incoming;
      showToast(`Loaded links from ${file.name}`);
    };
    reader.readAsText(file);
  }

  fileBrowseBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => loadFileIntoTextarea(e.target.files[0]));

  ["dragenter", "dragover"].forEach((evt) =>
    fileDrop.addEventListener(evt, (e) => {
      e.preventDefault();
      fileDrop.classList.add("drag");
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    fileDrop.addEventListener(evt, (e) => {
      e.preventDefault();
      fileDrop.classList.remove("drag");
    })
  );
  fileDrop.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    loadFileIntoTextarea(file);
  });

  // ---- Toast ------------------------------------------------------------
  let toastTimer = null;
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.remove("hidden");
    requestAnimationFrame(() => toastEl.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove("show");
      setTimeout(() => toastEl.classList.add("hidden"), 200);
    }, 3200);
  }

  // ---- Collect URLs -------------------------------------------------
  function collectUrls() {
    if (activeTab === "single") {
      const v = singleUrlInput.value.trim();
      return v ? [v] : [];
    }
    return bulkUrlsInput.value
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
  }

  // ---- Rendering ------------------------------------------------------
  const PLATFORM_LABEL = { youtube: "YouTube", instagram: "Instagram", facebook: "Facebook", other: "Link" };

  function fmtBytes(n) {
    if (!n) return "";
    const units = ["B/s", "KB/s", "MB/s", "GB/s"];
    let i = 0;
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024;
      i++;
    }
    return `${n.toFixed(1)} ${units[i]}`;
  }

  function fmtEta(s) {
    if (s === null || s === undefined) return "";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")} left`;
  }

  function renderQueue(job) {
    queueList.innerHTML = "";
    if (!job || !job.items.length) {
      queueEmpty.classList.remove("hidden");
      return;
    }
    queueEmpty.classList.add("hidden");

    job.items.forEach((item) => {
      const li = document.createElement("li");
      li.className = "queue-item";

      const top = document.createElement("div");
      top.className = "queue-item-top";

      const platformBadge = document.createElement("span");
      platformBadge.className = `platform-badge ${item.platform}`;
      platformBadge.textContent = PLATFORM_LABEL[item.platform] || "Link";

      const title = document.createElement("span");
      title.className = "item-title";
      title.textContent = item.title || item.filename || item.url;
      title.title = item.url;

      const statusPill = document.createElement("span");
      statusPill.className = `status-pill ${item.status}`;
      statusPill.textContent = item.status;

      top.append(platformBadge, title, statusPill);

      const track = document.createElement("div");
      track.className = "progress-track";
      const fill = document.createElement("div");
      fill.className = "progress-fill";
      fill.style.width = `${item.percent || 0}%`;
      track.appendChild(fill);

      const meta = document.createElement("div");
      meta.className = "item-meta";
      const left = document.createElement("span");
      left.textContent = item.status === "downloading" ? fmtBytes(item.speed) : "";
      const right = document.createElement("span");
      right.textContent = item.status === "downloading" ? fmtEta(item.eta) : item.status === "done" ? (item.filename || "") : "";
      meta.append(left, right);

      li.append(top, track, meta);

      if (item.status === "error" && item.error) {
        const err = document.createElement("div");
        err.className = "item-error";
        err.textContent = item.error;
        li.appendChild(err);
      }

      queueList.appendChild(li);
    });
  }

  function renderLibrary(data) {
    libraryList.innerHTML = "";
    const files = data.files || [];
    if (!files.length) {
      libraryEmpty.classList.remove("hidden");
      return;
    }
    libraryEmpty.classList.add("hidden");
    files.forEach((f) => {
      const li = document.createElement("li");
      li.className = "library-item";
      const name = document.createElement("span");
      name.className = "lname";
      name.textContent = f.name;
      const meta = document.createElement("span");
      meta.className = "lmeta";
      meta.textContent = `${(f.size / (1024 * 1024)).toFixed(1)} MB`;
      li.append(name, meta);
      libraryList.appendChild(li);
    });
  }

  async function refreshLibrary() {
    const dir = outputDirInput.value.trim() || "downloads";
    try {
      const res = await fetch(`/api/library?dir=${encodeURIComponent(dir)}`);
      const data = await res.json();
      renderLibrary(data);
    } catch (e) {
      // silent — library refresh is best-effort
    }
  }

  // ---- Job polling ------------------------------------------------------
  async function pollJob(jobId) {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) return;
      const job = await res.json();
      renderQueue(job);
      if (job.finished) {
        clearInterval(pollTimer);
        pollTimer = null;
        currentJobId = null;
        downloadBtn.disabled = false;
        cancelBtn.classList.add("hidden");
        const c = job.counts;
        showToast(`Job finished — ${c.done} done, ${c.error} failed, ${c.cancelled} cancelled`);
        refreshLibrary();
      }
    } catch (e) {
      // network hiccup — keep polling
    }
  }

  async function startDownload() {
    formError.classList.add("hidden");
    const urls = collectUrls();
    if (!urls.length) {
      formError.textContent = "Paste at least one http(s) link first.";
      formError.classList.remove("hidden");
      return;
    }

    downloadBtn.disabled = true;
    const payload = {
      urls,
      quality: qualitySelect.value,
      output_dir: outputDirInput.value.trim() || "downloads",
      cookies_browser: cookiesSelect.value,
    };

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        formError.textContent = data.error || "Could not start download.";
        formError.classList.remove("hidden");
        downloadBtn.disabled = false;
        return;
      }
      currentJobId = data.id;
      renderQueue(data);
      cancelBtn.classList.remove("hidden");
      showToast(`Started ${data.items.length} download${data.items.length > 1 ? "s" : ""}`);
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(() => pollJob(currentJobId), 900);
    } catch (e) {
      formError.textContent = "Could not reach the local server.";
      formError.classList.remove("hidden");
      downloadBtn.disabled = false;
    }
  }

  downloadBtn.addEventListener("click", startDownload);

  cancelBtn.addEventListener("click", async () => {
    if (!currentJobId) return;
    await fetch(`/api/jobs/${currentJobId}/cancel`, { method: "POST" });
    showToast("Cancelling remaining items…");
  });

  openFolderBtn.addEventListener("click", async () => {
    const dir = outputDirInput.value.trim() || "downloads";
    await fetch("/api/open-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dir }),
    });
  });

  refreshLibraryBtn.addEventListener("click", refreshLibrary);

  // initial load
  refreshLibrary();
})();
