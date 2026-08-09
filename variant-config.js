// GeoMap distribution variant configuration.
// The same source tree powers both Full and Lite deployments.
(function configureGeomapVariant() {
    const explicitVariant = window.GEOMAP_VARIANT;
    const queryVariant = new URLSearchParams(window.location.search).get('variant');
    const hostedAsLite = window.location.pathname.toLowerCase().includes('geomap-app-lite');
    // Query string is the public distribution override used by the Lite entry.
    // A build-time explicit value remains the fallback for standalone bundles.
    const requestedVariant = queryVariant || explicitVariant || (hostedAsLite ? 'lite' : 'full');
    const variant = requestedVariant === 'lite' ? 'lite' : 'full';

    window.GEOMAP_VARIANT = variant;
    window.GEOMAP_FEATURES = Object.freeze({
        eventTracker: variant === 'full'
    });

    document.documentElement.dataset.geomapVariant = variant;
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('[data-feature="event-tracker"]').forEach((element) => {
            element.hidden = !window.GEOMAP_FEATURES.eventTracker;
        });
    });
})();
