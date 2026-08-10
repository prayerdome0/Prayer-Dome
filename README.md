<p align="center">
  <img src="assets/logo.png" alt="Prayer Dome logo" width="180">
</p>

# Prayer Dome

**A House of Prayer for All Nations**

Prayer Dome is a Christian community website for prayer, Bible study, discipleship, worship, testimony, fellowship and practical care. Visit **[prayerdome.net](https://prayerdome.net)**.

> “He hath done all things well.” — Mark 7:37

## What is on the website

- **Home** — announcements, featured Scripture, daily devotional, weekly prayer challenge, events and news.
- **Prayer Wall** — share requests, pray with others and celebrate answered prayer.
- **Bible** — read Scripture, search passages, write notes and follow reading progress.
- **Prayer Dome Academy** — lessons, Bible stories, quizzes, resources and completion certificates.
- **Live Services** — current broadcasts, upcoming services, live conversation and prayer responses.
- **Sermons** — teachings and Bible stories with Scripture, reflection, prayer and narration.
- **Radio and Media** — gospel radio, podcasts, worship video and other Christian content.
- **News and Events** — ministry updates, Christian news and gathering information.
- **Testimonies and Gallery** — approved stories and images celebrating God’s faithfulness.
- **Community Chat** — respectful conversation for signed-in members.
- **Membership, Giving and Support** — membership applications, giving options and member care requests.
- **Documents** — statement of faith, discipleship guides, prayer tools, handbooks and the website user guide.

## How to use Prayer Dome

1. Open [prayerdome.net](https://prayerdome.net).
2. Use the main menu or Home page cards to choose an area.
3. Create an account when you want to post, save progress, join conversations or use member features.
4. Choose a language and light or dark appearance using the controls in the top bar.
5. Select the notification bell to review ministry notices and live-service alerts.
6. On a supported phone, use **Add to Home Screen** or **Install App** for quick access.

## Academy certificates

Pass an Academy quiz with **80% or higher** to earn a certificate. Open **Account → My Certificates**, then choose **Download** or **Print**. Enter your preferred full name before taking a quiz so it appears correctly on the certificate.

## Guides and documents

Open the **[Resource Library](https://prayerdome.net/resources.html)** to read, download or print all Prayer Dome documents. Every published document uses the official Prayer Dome logo.

The complete **[Prayer Dome Website User Guide](https://prayerdome.net/Prayer-Dome-User-Guide.pdf)** explains each feature, account use, Academy certificates, mobile access, privacy, safety and troubleshooting.

## Help

Use the **[Contact page](https://prayerdome.net/contact.html)** for prayer support, account help, document requests or accessibility feedback. When reporting a website problem, include the page name, what you selected and what appeared. Never send your password.

## Free service configuration

The community features use services with free tiers and browser APIs:

- **Firebase Authentication + Firestore** — sign-in, member profiles, presence, chat, receipts, typing, live chat and reactions.
- **Cloudinary unsigned upload** — photos, documents and voice notes upload directly in the background using the existing `cloudName` and upload-preset names. The browser never opens a Cloudinary page. Keep API secrets server-side.
- **HLS.js** — free open-source HLS playback for live broadcasts. Admins can publish with OBS, Larix or PRISM using the RTMP details in Admin → Live.
- **PeerJS WebRTC** — one-to-one voice and video calling through the free public signalling broker; the media connection is peer-to-peer and needs no paid API key.

Free tiers have quotas and are not a guarantee of production-scale capacity. Configure Firebase rules and Cloudinary upload presets before launch, and never put a Cloudinary API secret in browser code.
