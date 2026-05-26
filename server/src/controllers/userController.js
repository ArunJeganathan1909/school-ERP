const User =  require('../models/User');

// GET /api/users - admin only
exports.getAllUsers = async (req, res) => {
    try {
        const {
            role,
            search,
            page = 1,
            limit = 20
        } = req.query;

        const filter = {};
        if (role) filter.role = role;
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);
        const [users, total] = await Promise.all([
            User.find(filter).select('-password').skip(skip).limit(Number(limit)).sort({ createdAt: -1 }),
            User.countDocuments(filter),
        ]);

        res.status(200).json({
            success: true,
            total,
            page: Number(page),
            pages: Math.ceil(total / limit),
            users,
        });

    } catch (error){
        res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}

// GET /api/users/:id - admin or own profile
exports.getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) return res.status(404).json({
            success: false,
            message: 'User not found'
        });

    // Non-admin can only view their own profile

        if (req.user.role !== 'admin' && req.user.id !== req.params.id){
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }
        res.status(200).json({
            success: true,
            user
        });

    } catch(error){
        res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}


// PUT /api/users/:id - admin or own profile
exports.updateUser = async (req, res) => {
    try {
        const { name, phone, profilePhoto } = req.body;

    //     Non-admin can only update their own profile
        if (req.user.role !== 'admin' && req.user.id !== req.params.id){
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            })
        }

    //      Only admins can change roles or active status
        const updateData = { name, phone, profilePhoto };
        if (req.user.role === 'admin'){
            if(req.body.role) updateData.role = req.body.role;
            if (typeof req.body.isActive === 'boolean') updateData.isActive = req.body.isActive;
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) return res.status(404).json({
            success: false,
            message: 'User not found'
        })

        res.status(200).json({
            success: true,
            user
        })

    } catch (error){
        res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}

// DELETE /api/users/:id - admin only
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({
            success: false,
            message: 'User not found'
        })

        res.status(200).json({
            success: true,
            message: 'Successfully user deleted'
        })
    } catch (error){
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

// GET /api/users/profile - own profile (any roles)
exports.getMyProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.status(200).json({
            success: true,
            user
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

// PUT /api/users/profile -update own profile + password change
exports.updateMyProfile = async (req, res) => {
    try {
        const { name, phone, profilePhoto, currentPassword, newPassword } = req.body;

        const user = await User.findById(req.user.id).select('+password');

        if (newPassword){
            if (!currentPassword){
                return res.status(400).json({
                    success: false,
                    message: 'Current password required'
                })
            }
            const isMatch = await user.comparePassword(currentPassword);
            if (!isMatch){
                return res.status(401).json({
                    success: false,
                    message: 'Current password is incorrect'
                })
            }
            user.password = newPassword;
        }

        if (name) user.name = name;
        if (phone) user.phone = phone;
        if (profilePhoto) user.profilePhoto = profilePhoto;

        await user.save();

        const updated = await User.findById(req.user.id).select('-password');
        res.status(200).json({
            success: true,
            user: updated
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}