function handler(event) {
    var request = event.request;
    var uri = request.uri;

    // Directory requests and extension-less paths are SPA routes. Let
    // index.html handle them; real assets keep their original path.
    if (uri.endsWith('/')) {
        request.uri = uri + 'index.html';
    } else {
        var lastSegment = uri.substring(uri.lastIndexOf('/') + 1);
        if (lastSegment.indexOf('.') === -1) {
            request.uri = '/index.html';
        }
    }

    return request;
}
