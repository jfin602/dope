const canvas = document.getElementById('game') as HTMLCanvasElement;
const context = canvas.getContext('2d');
context.fillStyle = '#07152c';
context.fillRect(0, 0, canvas.width, canvas.height);
context.fillStyle = '#e5f5ff';
context.fillText('Meteor Dodge', 24, 32);
