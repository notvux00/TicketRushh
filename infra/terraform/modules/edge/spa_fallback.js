function handler(event) {
    var request = event.request;
    var uri = request.uri;

    // SPA routes, including their trailing-slash form, share the root index.
    // Real assets keep their original path; query strings are untouched.
    var normalized = uri.replace(/\/+$/, '');
    var lastSegment = normalized.substring(normalized.lastIndexOf('/') + 1);
    if (lastSegment.indexOf('.') === -1) {
        request.uri = '/index.html';
    }

    return request;
}
