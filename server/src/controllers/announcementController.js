const Announcement = require('../models/Announcement');
const { broadcastAnnouncement, notify } = require('../socket/socketHelpers');
const User = require('../models/User');

// GET /api/announcements
exports.getAnnouncements = async (req, res) => {
    try {
        const { course, page = 1, limit = 20 } = req.query;

        // Filter by role audience
        const audienceFilter = [
            { audience: 'all' },
            { audience: req.user.role },
        ];

        const filter = {
            isPublished: true,
            $or: audienceFilter,
            $and: [
                { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] },
            ],
        };

        if (course) filter.course = course;

        const skip = (Number(page) - 1) * Number(limit);

        const [announcements, total] = await Promise.all([
            Announcement.find(filter)
                .populate('author', 'name role profilePhoto')
                .populate('course', 'title code')
                .sort({ isPinned: -1, createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),
            Announcement.countDocuments(filter),
        ]);

        res.status(200).json({ success: true, announcements, total });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/announcements/:id
exports.getAnnouncement = async (req, res) => {
    try {
        const a = await Announcement.findById(req.params.id)
            .populate('author', 'name role profilePhoto')
            .populate('course', 'title code');
        if (!a) return res.status(404).json({ success: false, message: 'Not found' });
        res.status(200).json({ success: true, announcement: a });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/announcements — admin or teacher
exports.createAnnouncement = async (req, res) => {
    try {
        const announcement = await Announcement.create({
            ...req.body,
            author: req.user._id,
        });

        await announcement.populate('author', 'name role');

        // Broadcast via socket
        broadcastAnnouncement(announcement);

        // Also create DB notifications for all relevant users
        const audienceFilter = announcement.audience === 'all'
            ? {}
            : { role: announcement.audience };

        const users = await User.find({ ...audienceFilter, isActive: true }).select('_id');
        const recipientIds = users.map((u) => u._id).filter((id) => String(id) !== String(req.user._id));

        if (recipientIds.length > 0) {
            await notify({
                recipientId: recipientIds,
                type: 'announcement',
                title: announcement.title,
                message: announcement.content.slice(0, 120),
                link: `/announcements/${announcement._id}`,
            });
        }

        res.status(201).json({ success: true, announcement });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/announcements/:id
exports.updateAnnouncement = async (req, res) => {
    try {
        const a = await Announcement.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        ).populate('author', 'name role');

        if (!a) return res.status(404).json({ success: false, message: 'Not found' });
        res.status(200).json({ success: true, announcement: a });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE /api/announcements/:id
exports.deleteAnnouncement = async (req, res) => {
    try {
        await Announcement.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: 'Announcement deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};