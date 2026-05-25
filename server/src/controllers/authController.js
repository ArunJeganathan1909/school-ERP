const jwt = require('jsonwebtoken');
const User = require('../models/User');

const signToken = (id, role) => {
    return jwt.sign({id, role}, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN,
    });
};

const sendTokenResponse = (user, statusCode, res) => {
    const token = signToken(user._id, user.role);
    res.status(statusCode).json({
        success: true,
        token,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        },
    })
}

// POST /api/auth/register
exports.register = async (req, res) => {
    try{
        const { name, email, password, phone, role } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already registered in this email'
            })
        }

        const assignedRole = role && ['teacher', 'admin'].includes(role) ? role : 'student';

        const user = await User.create({ name, email, password, phone, role: assignedRole });
        sendTokenResponse(user, 201, res)

    } catch (error){
        res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}

// POST /api/auth/login
exports.login = async (req, res) => {
    try{
        const { email, password } = req.body;

        if(!email || !password){
            res.status(400).json({
                success: false,
                message: 'Email and password required'
            })
        }

        const user = await User.findOne({ email }).select('+password');
        if(!user || !(await user.comparePassword(password))){
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            })
        }

        if (!user.isActive){
            return res.status(403).json({
                success: false,
                message: 'Account deactivated'
            })
        }

        sendTokenResponse(user, 200, res);
    } catch (error){
        res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}

// GET /api/auth/me
exports.getMe = async (req, res) => {
    try{
        const user = await User.findById(req.user._id);
        res.status(200).json({
            success: true,
            user
        })
    } catch (error){
        res.status(500).json({
            success: false,
            message:error.message,
        })
    }
}