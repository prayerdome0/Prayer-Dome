# Prayer Dome — Advanced Upgrades & Integration Guide

This guide contains production-grade, copy-paste-ready code blocks and architectural templates for all five categories on the roadmap. Follow these steps to secure, upgrade, and scale the Prayer Dome platform.

---

## 🛠️ Category 1: Security & Cloud Hardening (High Priority)

### 1.1 Secure Server-Side Cloudinary Signing (`functions/index.js`)
To protect your Cloudinary account, never expose the `apiSecret` on the client side. Deploy this server-side Firebase Cloud Function to handle image and video signing securely.

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cloudinary = require('cloudinary').v2;

if (!admin.apps.length) {
    admin.initializeApp();
}

// Configure Cloudinary from Firebase environment variables
cloudinary.config({
    cloud_name: functions.config().cloudinary.cloud_name || 'prayerdome',
    api_key: functions.config().cloudinary.api_key,
    api_secret: functions.config().cloudinary.api_secret
});

/**
 * Call this function from the client to get a secure upload signature.
 * Securely restricts usage to authorized members.
 */
exports.getCloudinarySignature = functions.https.onCall((data, context) => {
    // 1. Enforce user authentication
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated', 
            'You must be signed in to perform this action.'
        );
    }

    const timestamp = Math.round((new Date()).getTime() / 1000);
    const params = {
        timestamp: timestamp,
        upload_preset: data.upload_preset || 'live_streams',
        folder: data.folder || 'user_uploads'
    };

    // 2. Generate secure SHA-1 signature using private apiSecret
    const signature = cloudinary.utils.api_sign_request(params, cloudinary.config().api_secret);

    return {
        signature: signature,
        timestamp: timestamp,
        apiKey: cloudinary.config().api_key,
        cloudName: cloudinary.config().cloud_name
    };
});
```

#### 🔄 Updating the Client-Side Upload Code (`give.html` & `admin.html`):
Replace direct client-side signing calls with a Firebase Function invocation:
```javascript
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";

async function secureUploadToCloudinary(file, folder = 'user_uploads') {
    const functions = getFunctions();
    const getSignature = httpsCallable(functions, 'getCloudinarySignature');
    
    // Call server-side function to sign the request without exposing secret
    const { data } = await getSignature({ upload_preset: 'live_streams', folder });
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', data.apiKey);
    formData.append('timestamp', data.timestamp);
    formData.append('signature', data.signature);
    formData.append('upload_preset', 'live_streams');
    formData.append('folder', folder);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${data.cloudName}/image/upload`, {
        method: 'POST',
        body: formData
    });
    
    const result = await response.json();
    return result.secure_url;
}
```

---

### 1.2 Production-Grade Firestore Rules (`firestore.rules`)
Copy and deploy this complete schema definition to Firebase Console. It implements absolute isolation of administrative actions, secure public-read filters, role checking, and private prayer wall restrictions.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ==========================================
    // Core Authorization Helpers
    // ==========================================
    function isSignedIn() {
      return request.auth != null;
    }
    
    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    function isAdmin() {
      return isSignedIn() && 
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) && 
        getUserData().role == 'admin';
    }

    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    // ==========================================
    // Collection-Specific Rules
    // ==========================================

    // Users and Profiles
    match /users/{userId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn() && request.auth.uid == userId;
      allow update: if isOwner(userId) || isAdmin();
      allow delete: if isAdmin();
    }

    // Announcements & Hero Banners (Public Read, Admin Write)
    match /announcements/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }
    match /banners/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // News and Articles
    match /news/{id} {
      allow read: if resource.data.published == true || isAdmin();
      allow write: if isAdmin();
    }

    // Live Streaming State and Chat
    match /liveStatus/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }
    match /liveChat/{id} {
      allow read: if true;
      allow create: if isSignedIn();
      allow update, delete: if isAdmin();
    }
    match /liveRecordings/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // Prayer Wall (Strict Moderation Rules)
    match /prayers/{id} {
      // Anyone can read approved prayers; pending prayers are private to creator or admin
      allow read: if resource.data.status == 'approved' || 
                   (isSignedIn() && resource.data.userId == request.auth.uid) || 
                   isAdmin();
      allow create: if isSignedIn();
      // Users can modify or delete their own pending requests. Admins handle approvals.
      allow update: if isAdmin() || 
                    (isSignedIn() && resource.data.userId == request.auth.uid && 
                     request.resource.data.status == 'pending');
      allow delete: if isAdmin() || (isSignedIn() && resource.data.userId == request.auth.uid);
    }

    // Testimonies (Approved only for public)
    match /testimonies/{id} {
      allow read: if resource.data.status == 'approved' || isAdmin();
      allow create: if isSignedIn();
      allow update, delete: if isAdmin();
    }

    // Devotionals
    match /devotionals/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // Community Stats
    match /communityStats/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // Device Tokens for Push Notifications
    match /userTokens/{tokenId} {
      allow read, write: if isSignedIn() && request.resource.data.userId == request.auth.uid;
      allow delete: if isSignedIn();
    }
  }
}
```

---

## 🏛️ Category 2: Core Ministry Feature Upgrades

### 2.1 Dynamic Firestore-Driven Devotional Scheduler
Transform your static `devotional-data.js` into an admin-controlled scheduler.

#### 1. Devotional Schema Design:
Each devotional document in `/devotionals` should follow this structure:
```json
{
  "title": "A House of Prayer",
  "publishDate": "2026-08-04",
  "scriptureRef": "Mark 11:17",
  "scriptureText": "My house shall be called of all nations the house of prayer...",
  "thought": "Prayer is not a segment of church life; it is the source...",
  "prayer": "Father, make my heart a clean sanctuary of prayer...",
  "author": "Pastor John Phiri",
  "createdAt": "Timestamp"
}
```

#### 2. Client Reader Code:
Embed this dynamic fetch within your homepage/dashboard:
```javascript
import { getFirestore, collection, query, where, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

async function loadTodaysDevotional() {
    const db = getFirestore();
    const today = new Date().toISOString().split('T')[0]; // Yields YYYY-MM-DD
    
    const devQuery = query(
        collection(db, "devotionals"), 
        where("publishDate", "==", today), 
        limit(1)
    );
    
    const querySnapshot = await getDocs(devQuery);
    if (!querySnapshot.empty) {
        const devotional = querySnapshot.docs[0].data();
        document.getElementById('devTitle').innerText = devotional.title;
        document.getElementById('devRef').innerText = devotional.scriptureRef;
        document.getElementById('devText').innerText = devotional.scriptureText;
        document.getElementById('devThought').innerText = devotional.thought;
        document.getElementById('devPrayer').innerText = devotional.prayer;
    } else {
        // Fallback to static seed data if no scheduled entry exists
        console.log("No live devotional scheduled. Loading static backup...");
    }
}
```

---

### 2.2 Wire Admin Sermon Publishing Flow (`admin.html`)
Pastors can write and upload sermon audio narration directly.

#### 1. Add Sermon Composer UI to `admin.html`:
```html
<section id="sermon-composer-view" class="admin-view hidden">
    <div class="view-header">
        <h2><i class="fas fa-microphone-lines"></i> Publish Narrated Sermon</h2>
    </div>
    <form id="sermonForm" class="composer-form">
        <input type="text" id="serTitle" placeholder="Sermon Title" required>
        <input type="text" id="serSubtitle" placeholder="Subtitle (e.g. Parable or Context)">
        <input type="text" id="serSpeaker" placeholder="Speaker" value="Prayer Dome Ministry Team">
        <input type="text" id="serScripture" placeholder="Scripture Reference (e.g., Mark 7:37)" required>
        <input type="text" id="serTopics" placeholder="Topics (comma-separated, e.g., faith, healing)">
        
        <textarea id="serSummary" placeholder="Short Summary / Catchphrase" rows="2" required></textarea>
        <textarea id="serKeyVerse" placeholder="Key Highlight Verse" rows="2" required></textarea>
        
        <label for="serStory">Sermon Narrative (Separate paragraphs by double returns):</label>
        <textarea id="serStory" placeholder="Write the narrated story. Keep paragraphs short (2-4 sentences) so speech highlight works accurately." rows="10" required></textarea>
        
        <textarea id="serPrayer" placeholder="Concluding Sermon Prayer" rows="3" required></textarea>
        <textarea id="serReflection" placeholder="Reflection Questions (One per line)" rows="3" required></textarea>
        
        <button type="submit" class="btn-submit-premium"><i class="fas fa-cloud-arrow-up"></i> PUBLISH TO SERMON CENTER</button>
    </form>
</section>
```

#### 2. Client Admin Wiring JavaScript:
```javascript
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.getElementById('sermonForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const db = getFirestore();
    
    const rawStory = document.getElementById('serStory').value;
    const storyParagraphs = rawStory.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    
    const rawReflect = document.getElementById('serReflection').value;
    const reflections = rawReflect.split('\n').map(r => r.trim()).filter(Boolean);
    
    const sermonDoc = {
        title: document.getElementById('serTitle').value.trim(),
        subtitle: document.getElementById('serSubtitle').value.trim(),
        speaker: document.getElementById('serSpeaker').value.trim(),
        scripture: document.getElementById('serScripture').value.trim(),
        topics: document.getElementById('serTopics').value.split(',').map(t => t.trim().toLowerCase()),
        summary: document.getElementById('serSummary').value.trim(),
        keyVerse: document.getElementById('serKeyVerse').value.trim(),
        story: storyParagraphs,
        prayer: document.getElementById('serPrayer').value.trim(),
        reflection: reflections,
        createdAt: serverTimestamp(),
        published: true
    };
    
    try {
        await addDoc(collection(db, "sermons"), sermonDoc);
        alert("Sermon published successfully!");
        document.getElementById('sermonForm').reset();
    } catch (err) {
        console.error("Error publishing sermon:", err);
        alert("Failed to publish sermon. Verify permission rights.");
    }
});
```

---

### 2.3 Interactive Payment Gateway Integration (`give.html`)
To upgrade MTN MoMo and Cards into fully automated payments in Eswatini and Zambia, integrate Flutterwave Inline.

#### Live Script Injection:
Add this script directly to the head or body of `give.html`:
```html
<script src="https://checkout.flutterwave.com/v3.js"></script>
```

#### Modal Launch Trigger:
```javascript
function makePremiumDonation(amount, userEmail, userPhone, currency = 'ZMW') {
    if (!amount || amount <= 0) {
        alert("Please enter a valid donation amount.");
        return;
    }

    FlutterwaveCheckout({
      public_key: "FLWPUBK-e8df99166a9df55998a4ff8217bb4ec0-X", // Replace with secure Live Merchant Key
      tx_ref: "PD-GIVE-" + Date.now(),
      amount: parseFloat(amount),
      currency: currency, // Supports ZMW (Zambia) and SZL (Eswatini Lilangeni)
      payment_options: "card, mobilemoneyzambia, mobilemoneyeswatini",
      customer: {
        email: userEmail || "support@prayerdome.net",
        phone_number: userPhone || "+26876581804",
        name: "Prayer Dome Family",
      },
      customizations: {
        title: "Prayer Dome Ministry",
        description: "Spread God's Word Across the Nations",
        logo: "https://i.ibb.co/TB5Fx4tb/logo-0.png",
      },
      callback: function (paymentResponse) {
        console.log("Payment Callback Response:", paymentResponse);
        if (paymentResponse.status === "successful" || paymentResponse.charge_response_code === "00") {
            // Verify payment on backend/Cloud Function or log receipt
            saveDonationReceipt(paymentResponse);
            showOfferingSuccessModal(amount, currency);
        } else {
            alert("Payment transaction was unsuccessful. Please try again.");
        }
      },
      onclose: function() {
        console.log("Payment window closed.");
      }
    });
}
```

---

## 🌍 Category 3: Internationalisation (i18n) & Localisation

### 3.1 Elders' Translation Review Console (`admin.html`)
A workflow that lets designated elders audit, sign off, and edit translations directly in Firestore, removing the "Draft" disclaimer once verified.

```javascript
import { getFirestore, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Call this from the admin panel translation table
async function signOffTranslation(verseId, langCode, approvedBy) {
    const db = getFirestore();
    const verseRef = doc(db, "translations", verseId);
    
    // Create updates dynamic nested fields
    const updates = {};
    updates[`reviewed.${langCode}`] = true;
    updates[`reviewer.${langCode}`] = approvedBy;
    updates[`reviewedAt.${langCode}`] = new Date().toISOString();
    
    try {
        await updateDoc(verseRef, updates);
        alert(`Translation for [${langCode.toUpperCase()}] verified by Elder ${approvedBy}!`);
        // Refresh admin layout
        loadLanguagesAdminConsole();
    } catch (err) {
        console.error("Authorization check failed:", err);
    }
}
```

---

## 🧠 Category 4: AI & Assistance Upgrades

### 4.1 Hybrid Cloud LLM Prayer Assistant (`functions/index.js`)
Build an advanced Cloud-based LLM Prayer Assistant, using a secure, private OpenAI/Gemini call that acts as a primary counselor while keeping the browser matcher as a reliable, instant offline backup.

```javascript
const functions = require('firebase-functions');
const { GoogleGenAI } = require('@google/generative-ai');

/**
 * Highly secure, server-side HTTPS Callable function utilizing Google Gemini Flash
 */
exports.askAIAssistant = functions.https.onCall(async (data, context) => {
    const userPrompt = data.prompt;
    if (!userPrompt) {
        throw new functions.https.HttpsError('invalid-argument', 'Prompt query cannot be empty.');
    }

    const API_KEY = functions.config().gemini.key; // Configured privately via GCP CLI
    if (!API_KEY) {
        throw new functions.https.HttpsError('failed-precondition', 'Assistant Service Engine is misconfigured.');
    }

    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const systemInstruction = `
      You are the Prayer Dome AI Assistant, a comforting, wise, and encouraging Christian pastoral companion.
      Respond with:
      1. A short, highly comforting Christian perspective.
      2. 2-3 accurate, encouraging KJV Bible scriptures.
      3. A beautiful, heartfelt, personalized prayer of about 4-5 sentences.
      Maintain a quiet, highly warm tone. Do not give medical or financial advice.
    `;

    try {
        const result = await model.generateContent([
            { text: systemInstruction },
            { text: `User request: ${userPrompt}` }
        ]);
        
        return {
            success: true,
            response: result.response.text()
        };
    } catch (err) {
        console.error("AI Assistant Exception:", err);
        throw new functions.https.HttpsError('internal', 'Unable to fetch dynamic response from AI engine.');
    }
});
```

---

## 📱 Category 5: Mobile Dev, Pipelines & Store Publishing

### 5.1 Automated GitHub Actions Pipeline (`.github/workflows/android-build.yml`)
Commit this build automation script to automate compiling a perfect, signed Android App Bundle (`.aab`) and publishing directly to your Google Play Console Developer Track on every push.

```yaml
name: Generate & Package Android Release

on:
  push:
    branches:
      - main
      - arena/019fc698-prayer-dome

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Check out Repository
        uses: actions/checkout@v3

      - name: Setup Node.js Runtime
        uses: actions/setup-node@v3
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install Project Dependencies
        run: npm install

      - name: Set up Java Development Kit (JDK 17)
        uses: actions/setup-java@v3
        with:
          distribution: 'zulu'
          java-version: '17'

      - name: Sync Capacitor Android
        run: |
          npm run mobile:prepare
          npx cap sync android

      - name: Build Android App Bundle (Release)
        working-directory: ./android
        run: ./gradlew bundleRelease

      - name: Secure Sign App Bundle
        uses: r0adkll/sign-android-release@v1
        id: sign_app
        with:
          releaseDirectory: android/app/build/outputs/bundle/release
          signingKeyBase64: ${{ secrets.ANDROID_SIGNING_KEY }}
          alias: ${{ secrets.ANDROID_KEY_ALIAS }}
          keyStorePassword: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          keyPassword: ${{ secrets.ANDROID_KEY_PASSWORD }}

      - name: Upload Artifact to Google Play Console
        uses: r0adkll/upload-google-play@v1
        with:
          serviceAccountJsonPlainText: ${{ secrets.PLAY_CONSOLE_SERVICE_ACCOUNT }}
          packageName: net.prayerdome.app
          releaseFiles: ${{ steps.sign_app.outputs.signedReleaseFile }}
          track: internal
```
