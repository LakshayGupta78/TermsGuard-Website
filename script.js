// Enhanced theme toggle functionality for TermsGuard
document.addEventListener("DOMContentLoaded", () => {
  // Theme management
  let currentTheme = localStorage.getItem("theme") || "dark";
  const themeButton = document.getElementById("theme-button");
  const themeButtonSlider = document.getElementById("theme-button-slider");
  const body = document.body;
  
  // Initialize theme on page load
  initializeTheme();

  function initializeTheme() {
    if (currentTheme === "light") {
      applyLightTheme();
    } else {
      applyDarkTheme();
    }
  }

  function applyDarkTheme() {
    body.classList.remove("light-theme");
    body.classList.add("dark-theme"); // Optional if default is dark, but good for clarity
    
    if (themeButtonSlider) {
        themeButtonSlider.classList.remove("light-theme");
        themeButtonSlider.classList.add("dark-theme");
    }

    currentTheme = "dark";
    localStorage.setItem("theme", "dark");
  }

  function applyLightTheme() {
    body.classList.remove("dark-theme");
    body.classList.add("light-theme");
    
    if (themeButtonSlider) {
        themeButtonSlider.classList.remove("dark-theme");
        themeButtonSlider.classList.add("light-theme");
    }

    currentTheme = "light";
    localStorage.setItem("theme", "light");
  }

  function toggleTheme() {
    if (currentTheme === "dark") {
      applyLightTheme();
    } else {
      applyDarkTheme();
    }
  }

  // Add click event listener to theme button
  if (themeButton) {
      themeButton.addEventListener("click", toggleTheme);
  }

  // Mobile Menu Toggle
  const mobileMenuButton = document.getElementById("mobile-menu-button");
  const mobileMenu = document.getElementById("mobile-menu");
  if (mobileMenuButton && mobileMenu) {
      mobileMenuButton.addEventListener("click", () => {
        mobileMenu.classList.toggle("hidden");
      });
  }

  // File Upload & Analyzer Logic
  const dropZone = document.getElementById("drop-zone");
  const fileUpload = document.getElementById("file-upload");
  const previewImage = document.getElementById("preview-image");
  const uploadUi = document.getElementById("upload-ui"); // Updated ID
  const analyzeButton = document.getElementById("analyze-button");
  const buttonText = document.getElementById("button-text");
  const buttonSpinner = document.getElementById("button-spinner");

  const resultsModal = document.getElementById("results-modal");
  const closeModalButton = document.getElementById("close-modal-button");
  const modalContent = document.getElementById("modal-content");

  let uploadedFile = null; // Store the actual file object

  const handleFile = (file) => {
    if (file && file.type.startsWith("image/")) {
      uploadedFile = file; // Keep the file object
      const reader = new FileReader();
      reader.onload = (e) => {
        previewImage.src = e.target.result;
        previewImage.classList.remove("hidden");
        if (uploadUi) uploadUi.classList.add("hidden");
        analyzeButton.disabled = false;
      };
      reader.readAsDataURL(file);
    } else {
      alert("Please upload a valid image file (PNG, JPG).");
      uploadedFile = null;
      analyzeButton.disabled = true;
    }
  };

  if (fileUpload) {
      fileUpload.addEventListener("change", (e) => handleFile(e.target.files[0]));
  }

  // Drag and Drop Listeners
  if (dropZone) {
      dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("border-indigo-500", "bg-indigo-500/10");
      });
      dropZone.addEventListener("dragleave", (e) => {
        e.preventDefault();
        dropZone.classList.remove("border-indigo-500", "bg-indigo-500/10");
      });
      dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("border-indigo-500", "bg-indigo-500/10");
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleFile(e.dataTransfer.files[0]);
        }
      });
  }

  if (analyzeButton) {
      analyzeButton.addEventListener("click", () => {
        if (uploadedFile) {
          analyzeDocument(uploadedFile);
        }
      });
  }

  if (closeModalButton) {
      closeModalButton.addEventListener("click", () => {
        resultsModal.classList.add("hidden");
        resultsModal.classList.remove("flex");
      });
  }

  // Close modal on outside click
  if (resultsModal) {
      resultsModal.addEventListener("click", (e) => {
          if (e.target === resultsModal) {
            resultsModal.classList.add("hidden");
            resultsModal.classList.remove("flex");
          }
      });
  }

  const showLoading = (isLoading) => {
    buttonText.classList.toggle("hidden", isLoading);
    buttonSpinner.classList.toggle("hidden", !isLoading);
    analyzeButton.disabled = isLoading;
  };

  const displayResults = (data) => {
    let html = ``;
    if (data.error) {
      html += `<div class="bg-red-500/10 border border-red-500/30 text-red-300 p-6 rounded-2xl">
                        <p class="font-bold text-lg mb-2">An Error Occurred</p>
                        <p>${data.error}</p>
                    </div>`;
    } else {
      html += `<div class="mb-8">
                        <h3 class="text-xl font-bold text-indigo-400 mb-3">Summary</h3>
                        <p class="text-gray-300 leading-relaxed">${data.summary.replace(
                          /\n/g,
                          "<br>"
                        )}</p>
                    </div>`;
      if (data.keyDetails && data.keyDetails.length > 0) {
        html += `<div class="mb-8">
                            <h3 class="text-xl font-bold text-indigo-400 mb-3">Key Details</h3>
                            <ul class="space-y-3 text-gray-300">
                                ${data.keyDetails
                                  .map((detail) => `<li class="flex items-start"><span class="mr-2 text-indigo-500">•</span>${detail}</li>`)
                                  .join("")}
                            </ul>
                        </div>`;
      }
      if (data.risks && data.risks.length > 0) {
        html += `<div>
                            <h3 class="text-xl font-bold text-indigo-400 mb-4">Potential Risks</h3>
                            <div class="space-y-4">${data.risks
                              .map(getRiskHTML)
                              .join("")}</div>
                        </div>`;
      }
    }
    modalContent.innerHTML = html;
    resultsModal.classList.remove("hidden");
    resultsModal.classList.add("flex");
  };

  const getRiskHTML = (item) => {
    let colorClasses = "";
    let icon = "";
    switch (item.severity?.toLowerCase()) {
      case "high":
        colorClasses = "border-red-500/30 bg-red-500/10 text-red-200";
        icon = "🔴";
        break;
      case "medium":
        colorClasses = "border-yellow-500/30 bg-yellow-500/10 text-yellow-200";
        icon = "🟡";
        break;
      case "low":
        colorClasses = "border-green-500/30 bg-green-500/10 text-green-200";
        icon = "🟢";
        break;
      default:
        colorClasses = "border-gray-500/30 bg-gray-500/10 text-gray-300";
        icon = "⚪";
    }
    return `<div class="p-5 rounded-2xl border ${colorClasses} transition hover:scale-[1.01]">
                    <div class="flex items-center justify-between mb-2">
                        <span class="font-bold uppercase tracking-wider text-xs opacity-80">${
                          item.severity || "Notice"
                        }</span>
                        <span class="text-sm">${icon}</span>
                    </div>
                    <p class="font-medium leading-relaxed">${item.risk}</p>
                </div>`;
  };

  async function analyzeDocument(file) {
    showLoading(true);
    const formData = new FormData();
    formData.append("document", file);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || `Request failed with status ${response.status}`
        );
      }

      displayResults(data);
    } catch (error) {
      console.error("Error analyzing document:", error);
      displayResults({
        error: error.message || "Failed to connect to the analysis service.",
      });
    } finally {
      showLoading(false);
    }
  }
});
