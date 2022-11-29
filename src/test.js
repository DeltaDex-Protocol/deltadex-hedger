const Users = new Map();

const User = {
    address: null,
    positions: null,
}

function main() {
    const user = Object.create(User);
    user.address = "0x123";
    user.positions = 3;

    setMap(user);
    let val = mapTest(user);

    console.log(val);
}

function setMap (user) {
    Users.set(user.address, user.positions);
    console.log(Users);
}

function mapTest(user) {
    let val;
    val = Users.get(user.address);
    return val;
}

main();