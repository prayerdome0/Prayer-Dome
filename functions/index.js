const functions = require('firebase-functions');
const admin = require('firebase-admin');
const shareHandler = require('./share');

admin.initializeApp();

// Dynamic social sharing pages for news and testimony links.
// Hosting rewrites /news/{id}, /testimony/{id}, and /share/{type}/{id} here
// so Facebook, WhatsApp and other crawlers receive article-specific OG tags.
exports.share = functions.https.onRequest((req, res) => shareHandler(req, res));

// Send notifications when a new document is added to 'notifications' collection
exports.sendPushNotification = functions.firestore
    .document('notifications/{notificationId}')
    .onCreate(async (snap, context) => {
        const notification = snap.data();
        const { title, message, tokens, type } = notification;
        
        if (!tokens || tokens.length === 0) {
            console.log('No tokens to send to');
            return null;
        }
        
        // Filter out invalid tokens (FCM will reject them)
        const validTokens = tokens.filter(token => token && token.length > 20);
        
        if (validTokens.length === 0) {
            console.log('No valid tokens');
            return null;
        }
        
        const payload = {
            notification: {
                title: title,
                body: message,
                icon: 'https://i.ibb.co/TB5Fx4tb/logo-0.png',
                badge: 'https://i.ibb.co/TB5Fx4tb/logo-0.png',
                vibrate: '200,100,200',
                sound: 'default'
            },
            data: {
                click_action: 'FLUTTER_NOTIFICATION_CLICK',
                screen: type || 'news'
            }
        };
        
        try {
            const response = await admin.messaging().sendEachForMulticast({
                tokens: validTokens,
                ...payload
            });
            
            console.log(`Sent to ${response.successCount} devices, failed: ${response.failureCount}`);
            
            await snap.ref.update({
                status: 'sent',
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
                successCount: response.successCount,
                failureCount: response.failureCount
            });
            
            if (response.failureCount > 0) {
                const failedTokens = [];
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        failedTokens.push(validTokens[idx]);
                        console.error(`Failed token: ${validTokens[idx]}`, resp.error);
                    }
                });
                
                for (const failedToken of failedTokens) {
                    const tokensQuery = await admin.firestore()
                        .collection('userTokens')
                        .where('token', '==', failedToken)
                        .get();
                    
                    tokensQuery.forEach(doc => {
                        doc.ref.update({ active: false, invalidReason: 'token_expired' });
                    });
                }
            }
            
            return response;
        } catch (error) {
            console.error('Error sending notifications:', error);
            await snap.ref.update({
                status: 'failed',
                error: error.message
            });
            return null;
        }
    });

// Test notification handler
exports.sendTestNotification = functions.firestore
    .document('test_notifications/{testId}')
    .onCreate(async (snap, context) => {
        const test = snap.data();
        const { title, message, token } = test;
        
        if (!token) return null;
        
        const payload = {
            notification: {
                title: title,
                body: message,
                icon: 'https://i.ibb.co/TB5Fx4tb/logo-0.png'
            }
        };
        
        try {
            const response = await admin.messaging().send({
                token: token,
                ...payload
            });
            
            console.log('Test notification sent:', response);
            await snap.ref.update({
                status: 'sent',
                sentAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return response;
            
        } catch (error) {
            console.error('Test notification failed:', error);
            await snap.ref.update({
                status: 'failed',
                error: error.message
            });
            return null;
        }
    });
