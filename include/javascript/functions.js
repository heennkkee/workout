function edit(target, id) {
    window.location = target + '/edit/' + id;
}

function newLink(target) {
    window.location = target + '/new';
}

function goTo(target) {
    event.preventDefault();
    window.location = target;
}

function validate(form) {

}
