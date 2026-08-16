const { response } = require('@xedich/shared');
const authService = require('./auth.service');

const handleAuthError = (res, error) => {
    if (error.statusCode) {
        return response.error(res, error.message, error.statusCode);
    }
    console.error('[AuthController]', error);
    return response.error(res, 'Đã có lỗi xảy ra, vui lòng thử lại sau', 500);
};

const register = async (req, res) => {
    try {
        const {name, email, password, confirmPassword} = req.body;
        const result = await authService.register({name, email, password, confirmPassword});
        return response.ok(res, result, 'OTP đã được gửi, vui lòng kiểm tra email để hoàn tất đăng ký', 200);
    } catch (error) {
        return handleAuthError(res, error);
    }
}

const verifyOtp = async (req, res) => {
    try {
        const {email, otp} = req.body;
        const newUser = await authService.verifyOtp({email, otp});
        return response.ok(res, {userId: newUser}, 'User registered successfully', 201);
    } catch (error) {
        return handleAuthError(res, error);
    }
}

const cookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7*24*60*60*1000,
    sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Strict',
});

const login = async (req, res) => {
    try {
        const {email, password} = req.body;
        const { token, user } = await authService.login({email, password});
        res.cookie('token', token, cookieOptions());
        return response.ok(res, { user }, 'Login successful', 200);
    } catch (error) {
        return handleAuthError(res, error);
    }
}

const logout = async (req, res) => {
    const { maxAge, ...opts } = cookieOptions();
    res.clearCookie('token', opts);
    return response.ok(res, null, 'Logout successful', 200);
}

const resetPassword = async (req, res) => {
    try {
        const {email} = req.body;
        const result = await authService.resetPassword({email});
        return response.ok(res, result, 'OTP sent successfully', 200);
    } catch (error) {
        return handleAuthError(res, error);
    }
}

const verifyResetOtp = async (req, res) => {
    try {
        const {email, otp, password, confirmPassword} = req.body;
        const result = await authService.verifyResetOtp({email, otp, password, confirmPassword});
        return response.ok(res, result, 'Password reset successful', 200);
    } catch (error) {
        return handleAuthError(res, error);
    }
}

module.exports = { register, login, logout, verifyOtp, resetPassword, verifyResetOtp };
