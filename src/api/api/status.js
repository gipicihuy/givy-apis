module.exports = function (app) {

function listRoutes() {
    let routes = app._router.stack
        .filter(layer => layer.route)
        .map(layer => ({
            method: Object.keys(layer.route.methods).join(', ').toUpperCase(),
            path: layer.route.path
        }));
    
    // Filter HANYA endpoint API yang sebenarnya
    // Exclude HANYA: /api/config (internal), / (homepage)
    const excludedPaths = ['/api/config', '/'];
    
    const apiRoutes = routes.filter(route => !excludedPaths.includes(route.path));
    
    return apiRoutes.length;
}

app.get('/api/status', async (req, res) => {
        try {
            res.status(200).json({
                status: true,
                result: {
                    status: "Aktif", 
                    request: global.totalreq.toString(), 
                    endpoint: `${listRoutes()}`, 
                    runtime: runtime(process.uptime()), 
                    domain: req.hostname
                }
            });
        } catch (error) {
            res.status(500).send(`Error: ${error.message}`);
        }
});
}