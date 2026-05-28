const Notification = require('../models/Notification');

// GET /api/notifications — own notifications paginated
exports.getMyNotifications = async (req, res) => {
    try {
        const { page = 1, limit = 20, unreadOnly } = req.query;
        const filter = { recipient: req.user._id };
        if (unreadOnly === 'true') filter.isRead = false;

        const skip = (Number(page) - 1) * Number(limit);

        const [notifications, total, unreadCount] = await Promise.all([
            Notification.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),
            Notification.countDocuments(filter),
            Notification.countDocuments({ recipient: req.user._id, isRead: false }),
        ]);

        res.status(200).json({ success: true, notifications, total, unreadCount });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/notifications/:id/read — mark one as read
exports.markRead = async (req, res) => {
    try {
        const n = await Notification.findOneAndUpdate(
            { _id: req.params.id, recipient: req.user._id },
            { $set: { isRead: true, readAt: Date.now() } },
            { new: true }
        );
        if (!n) return res.status(404).json({ success: false, message: 'Not found' });
        res.status(200).json({ success: true, notification: n });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/notifications/read-all — mark all as read
exports.markAllRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { recipient: req.user._id, isRead: false },
            { $set: { isRead: true, readAt: Date.now() } }
        );
        res.status(200).json({ success: true, message: 'All notifications marked as read' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE /api/notifications/:id
exports.deleteNotification = async (req, res) => {
    try {
        await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });
        res.status(200).json({ success: true, message: 'Notification deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE /api/notifications — clear all
exports.clearAll = async (req, res) => {
    try {
        await Notification.deleteMany({ recipient: req.user._id });
        res.status(200).json({ success: true, message: 'All notifications cleared' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};