const { getIO } = require('./socketServer');
const Notification = require('../models/Notification');

/**
 * Create a DB notification AND emit it via socket in one call.
 * Used from controllers whenever something noteworthy happens.
 */

const notify = async ({
                          recipientId,       // single user ObjectId or array of ObjectIds
                          type,
                          title,
                          message,
                          link = '',
                          meta = {},
                      }) => {
    try {
        const io = getIO();
        const recipients = Array.isArray(recipientId) ? recipientId : [recipientId];

        // Create DB records
        const docs = await Notification.insertMany(
            recipients.map((r) => ({ recipient: r, type, title, message, link, meta }))
        );

        // Emit to each recipient's personal socket room
        docs.forEach((doc) => {
            io.to(`user:${doc.recipient}`).emit('notification:new', {
                _id: doc._id,
                type: doc.type,
                title: doc.title,
                message: doc.message,
                link: doc.link,
                isRead: false,
                createdAt: doc.createdAt,
            });
        });

        return docs;
    } catch (err) {
        // Never let notification failure break the main action
        console.error('Notify error:', err.message);
    }
};

/**
 * Broadcast an announcement to a role room or all users.
 */
const broadcastAnnouncement = (announcement) => {
    try {
        const io = getIO();
        const room = announcement.audience === 'all' ? 'role:student' : `role:${announcement.audience}`;

        // Emit to the right audience room(s)
        if (announcement.audience === 'all') {
            io.emit('announcement:new', announcement);
        } else {
            io.to(`role:${announcement.audience}`).emit('announcement:new', announcement);
        }
    } catch (err) {
        console.error('Broadcast error:', err.message);
    }
};

module.exports = { notify, broadcastAnnouncement };