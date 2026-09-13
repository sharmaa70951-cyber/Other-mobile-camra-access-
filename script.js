import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
  getDatabase,
  ref,
  set,
  get,
  onValue,
  push
} from
  "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

import {
  getAuth,
  signInAnonymously
} from
  "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD5kH_VWXI2r_znQbhlHenqDEZBJmnJcFM",
  authDomain: "camra-share.firebaseapp.com",
  databaseURL: "https://camra-share-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "camra-share",
  storageBucket: "camra-share.firebasestorage.app",
  messagingSenderId: "618409884143",
  appId: "1:618409884143:web:d787884065b651f54f9e1a",
  measurementId: "G-ZLF7B4GFR4"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);


// Anonymous login
await signInAnonymously(auth);


// Elements
const home = document.getElementById("home");
const guest = document.getElementById("guest");
const host = document.getElementById("host");

const createBtn = document.getElementById("createBtn");
const shareBtn = document.getElementById("shareBtn");

const roomInfo = document.getElementById("roomInfo");
const status = document.getElementById("status");
const hostStatus = document.getElementById("hostStatus");

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");


// WebRTC
let peerConnection;
let localStream;

const rtcConfig = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302"
    }
  ]
};


// Generate room ID
function generateRoomId() {
  return Math.random()
    .toString(36)
    .substring(2, 10);
}


// Convert Firebase snapshot data into ICE candidate
function addCandidateListener(roomId, type, callback) {

  const candidatesRef =
    ref(db, `rooms/${roomId}/${type}`);

  onValue(candidatesRef, snapshot => {

    const data = snapshot.val();

    if (!data) return;

    Object.values(data).forEach(candidate => {

      callback(candidate);

    });

  }, {
    onlyOnce: true
  });
}


// =============================
// HOST
// =============================

createBtn.addEventListener("click", async () => {

  const roomId = generateRoomId();

  home.style.display = "none";
  host.style.display = "block";

  const roomRef = ref(db, `rooms/${roomId}`);

  peerConnection = new RTCPeerConnection(rtcConfig);


  peerConnection.ontrack = event => {

    remoteVideo.srcObject = event.streams[0];

    hostStatus.textContent =
      "🎥 Guest camera stream connected.";

  };


  peerConnection.onicecandidate = async event => {

    if (!event.candidate) return;

    const candidateRef =
      push(ref(db, `rooms/${roomId}/hostCandidates`));

    await set(candidateRef, event.candidate.toJSON());

  };


  const offer = await peerConnection.createOffer();

  await peerConnection.setLocalDescription(offer);


  await set(ref(db, `rooms/${roomId}/offer`), {
    type: offer.type,
    sdp: offer.sdp
  });


  roomInfo.textContent =
    `Room ID: ${roomId}`;


  const inviteLink =
    `${window.location.origin}${window.location.pathname}?room=${roomId}`;

  hostStatus.innerHTML = `
    🔗 Guest को यह link भेजो:<br><br>
    <input value="${inviteLink}" readonly
      style="width:100%;padding:10px;">
    <br><br>
    <button id="copyBtn">Copy Link</button>
  `;


  document.getElementById("copyBtn").onclick = async () => {

    await navigator.clipboard.writeText(inviteLink);

    document.getElementById("copyBtn").textContent =
      "✅ Link Copied";

  };


  // Wait for answer
  onValue(
    ref(db, `rooms/${roomId}/answer`),
    async snapshot => {

      const answer = snapshot.val();

      if (!answer) return;

      if (peerConnection.currentRemoteDescription) return;

      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(answer)
      );

      hostStatus.textContent =
        "🔄 Camera connection स्थापित हो रही है...";

    }
  );


  // Guest ICE candidates
  onValue(
    ref(db, `rooms/${roomId}/guestCandidates`),
    snapshot => {

      const data = snapshot.val();

      if (!data) return;

      Object.values(data).forEach(async candidate => {

        try {

          await peerConnection.addIceCandidate(
            new RTCIceCandidate(candidate)
          );

        } catch (error) {
          console.log(error);
        }

      });

    }
  );

});


// =============================
// GUEST
// =============================

const params = new URLSearchParams(
  window.location.search
);

const roomId = params.get("room");


if (roomId) {

  home.style.display = "none";
  guest.style.display = "block";


  shareBtn.addEventListener("click", async () => {

    try {

      status.textContent =
        "📷 Camera permission माँगी जा रही है...";


      // IMPORTANT:
      // Camera is requested ONLY after user's button click.
      localStream =
        await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });


      localVideo.srcObject = localStream;
      localVideo.style.display = "block";


      shareBtn.disabled = true;

      status.textContent =
        "✅ Camera sharing चालू है।";


      peerConnection =
        new RTCPeerConnection(rtcConfig);


      localStream.getTracks().forEach(track => {

        peerConnection.addTrack(
          track,
          localStream
        );

      });


      peerConnection.onicecandidate =
        async event => {

          if (!event.candidate) return;

          const candidateRef =
            push(
              ref(
                db,
                `rooms/${roomId}/guestCandidates`
              )
            );

          await set(
            candidateRef,
            event.candidate.toJSON()
          );

        };


      // Get host offer
      const offerSnapshot =
        await get(
          ref(db, `rooms/${roomId}/offer`)
        );


      if (!offerSnapshot.exists()) {

        status.textContent =
          "❌ Room नहीं मिला।";

        return;

      }


      const offer = offerSnapshot.val();


      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer)
      );


      const answer =
        await peerConnection.createAnswer();


      await peerConnection.setLocalDescription(
        answer
      );


      await set(
        ref(db, `rooms/${roomId}/answer`),
        {
          type: answer.type,
          sdp: answer.sdp
        }
      );


      // Host ICE candidates
      onValue(
        ref(db, `rooms/${roomId}/hostCandidates`),
        snapshot => {

          const data = snapshot.val();

          if (!data) return;

          Object.values(data).forEach(async candidate => {

            try {

              await peerConnection.addIceCandidate(
                new RTCIceCandidate(candidate)
              );

            } catch (error) {
              console.log(error);
            }

          });

        }
      );


    } catch (error) {

      console.error(error);

      status.textContent =
        "❌ Camera permission नहीं मिली।";

    }

  });

        }
