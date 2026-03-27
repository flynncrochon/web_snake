let _cached = null;

export function is_mobile() {
    if (_cached === null) {
        _cached = ('ontouchstart' in window || navigator.maxTouchPoints > 0) &&
            window.matchMedia('(pointer: coarse)').matches;
    }
    return _cached;
}
