module.exports = [{
    identity: 'user',
    connection: 'localDisk',

    attributes: {
      name: 'string',
      password : {
        type : 'string'
      }
    },
    security : {
      password: ['encryptPermanent']
    },
    rest : true
  }]
