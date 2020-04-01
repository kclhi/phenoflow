'use strict';
module.exports = function(sequelize, DataTypes) {

	var implementation = sequelize.define('implementation', {

		id: {
		 type: DataTypes.INTEGER,
		 autoIncrement: true,
		 primaryKey: true
		},
		fileName: DataTypes.STRING

	});

	implementation.associate = function(models) {

		implementation.belongsTo(models.step, {

			onDelete: "CASCADE",
			foreignKey: {
				allowNull: false
			}

		});

	};

	return implementation;

};
