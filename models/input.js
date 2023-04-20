'use strict';
module.exports = function(sequelize, DataTypes) {

	var input = sequelize.define('input', {doc:DataTypes.STRING},{
		indexes: [
			{ unique: true, fields: [ 'stepId' ] } // ~MDC Eventually allow multiple inputs per step.
		]
	});

	input.associate = function(models) {
		input.belongsTo(models.step, {
			onDelete: "CASCADE",
			foreignKey: {
				allowNull: false
			}
		});
	};

	return input;

};
