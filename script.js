import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
  getDatabase,
  ref,
  set,
  get,
  onValue,
  onChildAdded,
  push
} from
  "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

import {
  getAuth,
  signInAnonymously
} from
  "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


// =============================
// FIREBASE
// =============================

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


// =============================
// ELEMENTS
// =============================

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


// =============================
// WEBRTC
// =============================

let peerConnection = null;
let localStream = null;

const rtcConfig = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302"
    }
  ]
};


// =============================
// ROOM ID
// =============================

function generateRoomId() {
  return Math.random()
    .toString(36)
    .substring(2, 10);
}


// =============================
// HOST
// =============================

createBtn.addEventListener("click", async () => {

  try {

    const roomId = generateRoomId();

    home.style.display = "none";
    host.style.display = "block";

    roomInfo.textContent = `Room ID: ${roomId}`;

    const roomRef = ref(db, `rooms/${roomId}`);

    peerConnection = new RTCPeerConnection(rtcConfig);


    // IMPORTANT:
    // Host is only receiving guest video.
    // Host camera is NOT requested.
    peerConnection.addTransceiver("video", {
      direction: "recvonly"
    });


    // Guest video arrives here
    peerConnection.ontrack = event => {

      console.log("Guest video received");

      if (event.streams && event.streams[0]) {

        remoteVideo.srcObject = event.streams[0];

        hostStatus.textContent =
          "🎥 Guest का live camera connected है।";

      }

    };


    peerConnection.onconnectionstatechange = () => {

      console.log(
        "Connection:",
        peerConnection.connectionState
      );

      if (
        peerConnection.connectionState === "connected"
      ) {

        hostStatus.textContent =
          "🟢 Guest का live camera दिखाई दे रहा है।";

      }

      if (
        peerConnection.connectionState === "disconnected" ||
        peerConnection.connectionState === "failed"
      ) {

        hostStatus.textContent =
          "❌ Camera connection बंद हो गया।";

      }

    };


    // Host ICE candidates
    peerConnection.onicecandidate = async event => {

      if (!event.candidate) return;

      const candidateRef =
        push(
          ref(
            db,
            `rooms/${roomId}/hostCandidates`
          )
        );

      await set(
        candidateRef,
        event.candidate.toJSON()
      );

    };


    // Create offer
    const offer =
      await peerConnection.createOffer();

    await peerConnection.setLocalDescription(
      offer
    );


    // Save offer
    await set(
      ref(db, `rooms/${roomId}/offer`),
      {
        type: offer.type,
        sdp: offer.sdp
      }
    );


    // Guest invite link
    const inviteLink =
      `${window.location.origin}${window.location.pathname}?room=${roomId}`;


    hostStatus.innerHTML = `
      🔗 Guest को यह link भेजो:<br><br>

      <input
        value="${inviteLink}"
        readonly
        style="width:100%;padding:10px;box-sizing:border-box;"
      >

      <br><br>

      <button id="copyBtn">
        Copy Link
      </button>

      <br><br>

      Guest link खोलकर
      <b>Yes, Share Camera</b>
      दबाएगा।
    `;


    const copyBtn =
      document.getElementById("copyBtn");


    copyBtn.onclick = async () => {

      try {

        await navigator.clipboard.writeText(
          inviteLink
        );

        copyBtn.textContent =
          "✅ Link Copied";

      } catch (error) {

        console.log(error);

      }

    };


    // =============================
    // WAIT FOR GUEST ANSWER
    // =============================

    onValue(
      ref(db, `rooms/${roomId}/answer`),

      async snapshot => {

        const answer = snapshot.val();

        if (!answer) return;

        if (
          peerConnection.currentRemoteDescription
        ) {
          return;
        }

        try {

          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(answer)
          );

          hostStatus.textContent =
            "🔄 Guest camera connection स्थापित हो रही है...";

        } catch (error) {

          console.error(
            "Answer error:",
            error
          );

        }

      }
    );


    // =============================
    // GUEST ICE
    // =============================

    onChildAdded(
      ref(db, `rooms/${roomId}/guestCandidates`),

      async snapshot => {

        const candidate =
          snapshot.val();

        if (!candidate) return;

        try {

          if (
            peerConnection.remoteDescription
          ) {

            await peerConnection.addIceCandidate(
              new RTCIceCandidate(candidate)
            );

          }

        } catch (error) {

          console.log(
            "Guest ICE error:",
            error
          );

        }

      }
    );


    hostStatus.innerHTML += `
      <br>
      ⏳ Guest के camera की waiting...
    `;


  } catch (error) {

    console.error(error);

    hostStatus.textContent =
      "❌ Room बनाने में problem हुई।";

  }

});


// =============================
// GUEST
// =============================

const params =
  new URLSearchParams(
    window.location.search
  );

const roomId =
  params.get("room");


if (roomId) {

  home.style.display = "none";
  guest.style.display = "block";


  shareBtn.addEventListener(
    "click",
    async () => {

      try {

        shareBtn.disabled = true;

        status.textContent =
          "📷 Camera permission माँगी जा रही है...";


        // ==================================
        // CAMERA ONLY AFTER USER CLICK
        // ==================================

        localStream =
          await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });


        // Show guest's own camera
        localVideo.srcObject =
          localStream;

        localVideo.style.display =
          "block";


        status.textContent =
          "✅ Camera permission मिल गई। Connecting...";


        // ==================================
        // WEBRTC CONNECTION
        // ==================================

        peerConnection =
          new RTCPeerConnection(rtcConfig);


        // Add camera tracks
        localStream
          .getTracks()
          .forEach(track => {

            peerConnection.addTrack(
              track,
              localStream
            );

          });


        // Guest ICE
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


        peerConnection.onconnectionstatechange =
          () => {

            console.log(
              "Guest connection:",
              peerConnection.connectionState
            );


            if (
              peerConnection.connectionState ===
              "connected"
            ) {

              status.textContent =
                "🟢 आपका camera दूसरे व्यक्ति को live दिखाई दे रहा है।";

            }


            if (
              peerConnection.connectionState ===
              "failed"
            ) {

              status.textContent =
                "❌ Camera connection failed.";

            }

          };


        // ==================================
        // GET HOST OFFER
        // ==================================

        const offerSnapshot =
          await get(
            ref(
              db,
              `rooms/${roomId}/offer`
            )
          );


        if (!offerSnapshot.exists()) {

          localStream
            .getTracks()
            .forEach(track => track.stop());

          status.textContent =
            "❌ Room नहीं मिला।";

          shareBtn.disabled = false;

          return;

        }


        const offer =
          offerSnapshot.val();


        // Set host offer
        await peerConnection
          .setRemoteDescription(
            new RTCSessionDescription(
              offer
            )
          );


        // ==================================
        // CREATE ANSWER
        // ==================================
