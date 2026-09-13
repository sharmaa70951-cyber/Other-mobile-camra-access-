const cameraBtn = document.getElementById("cameraBtn");
const camera = document.getElementById("camera");
const status = document.getElementById("status");

cameraBtn.addEventListener("click", async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false
    });

    camera.srcObject = stream;
    camera.style.display = "block";
    status.textContent = "✅ Camera permission मिल गई।";
    cameraBtn.textContent = "Camera चालू है";
    cameraBtn.disabled = true;

  } catch (error) {
    status.textContent =
      "❌ Camera permission नहीं मिली। कृपया browser permission check करें।";
  }
});
