'use strict';
const bcrypt = require("bcrypt");

module.exports = function(sequelize, DataTypes) {

	var user = sequelize.define('user', {
		name: {
		 primaryKey: true,
		 type: DataTypes.STRING,
		 allowNull: false
	 	},
		password: {
		 type: DataTypes.STRING,
		 allowNull: false
	 	},
    restricted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
	 	verified: DataTypes.BOOLEAN,
	 	homepage: DataTypes.STRING
	});

	user.beforeCreate(async (user, options) => {
	  const hashedPassword = await bcrypt.hash(user.password, 10);
	  user.password = hashedPassword;
	});

	return user;

};
