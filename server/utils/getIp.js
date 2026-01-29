const getIp = (req) => {
    let ip = req.ip ||
        req.headers['x-forwarded-for'] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        req.connection?.socket?.remoteAddress;

    if (ip && typeof ip === 'string' && ip.includes(',')) {
        ip = ip.split(',')[0].trim();
    }

    if (ip && typeof ip === 'string' && ip.includes('::ffff:')) {
        ip = ip.replace('::ffff:', '');
    }

    if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') {
        return 'Localhost';
    }

    return ip || 'Unknown';
};

module.exports = getIp;
