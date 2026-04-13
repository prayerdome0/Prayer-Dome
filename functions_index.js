const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

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
                screen: 'bible'
            }
        };
        
        try {
            const response = await admin.messaging().sendEachForMulticast({
                tokens: validTokens,
                ...payload
            });
            
            console.log(`Sent to ${response.successCount} devices, failed: ${response.failureCount}`);
            
            // Update notification status in Firestore
            await snap.ref.update({
                status: 'sent',
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
                successCount: response.successCount,
                failureCount: response.failureCount
            });
            
            // Handle failed tokens (remove invalid ones)
            if (response.failureCount > 0) {
                const failedTokens = [];
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        failedTokens.push(validTokens[idx]);
                        console.error(`Failed token: ${validTokens[idx]}`, resp.error);
                    }
                });
                
                // Remove invalid tokens from userTokens collection
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
        const { title, message, token, userId } = test;
        
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
            
        } catch (error) {
            console.error('Test notification failed:', error);
            await snap.ref.update({
                status: 'failed',
                error: error.message
            });
        }
    });