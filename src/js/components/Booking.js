//import { init } from './browser-sync';
import { templates, select, settings, classNames } from '../settings.js';
import { utils } from '../utils.js';
import AmountWidget from './AmountWidget.js';
import DatePicker from './DatePicker.js';
import HourPicker from './HourPicker.js';

class Booking {
  constructor(booking) {
    const thisBooking = this;
    thisBooking.render(booking);
    thisBooking.initWidgets();
    thisBooking.getData();
    thisBooking.tableSelect();

  }

  getData() {
    const thisBooking = this;
    const startDayParam = settings.db.dateStartParamKey + '=' + utils.dateToStr(thisBooking.datePicker.minDate);
    const endDayParam = settings.db.dateEndParamKey + '=' + utils.dateToStr(thisBooking.datePicker.maxDate);

    const params = {
      booking: [
        startDayParam,
        endDayParam,
      ],
      eventsCurrent: [
        settings.db.notRepeatParam,
        startDayParam,
        endDayParam,
      ],
      eventsRepeat: [
        settings.db.RepeatParam,
        endDayParam,
      ],
    };

    //console.log('getData params',params);

    const urls = {
      booking: settings.db.url + '/' + settings.db.booking
        + '?' + params.booking.join('&'),
      eventsCurrent: settings.db.url + '/' + settings.db.event
        + '?' + params.eventsCurrent.join('&'),
      eventsRepeat: settings.db.url + '/' + settings.db.event
        + '?' + params.eventsRepeat.join('&'),
    };

    //console.log('getData urls', urls);

    Promise.all([
      fetch(urls.booking),
      fetch(urls.eventsCurrent),
      fetch(urls.eventsRepeat),
    ])
      .then(function (allResposes) {
        const bookingResponse = allResposes[0];
        const eventsCurrentResponse = allResposes[1];
        const eventsRepeatResponse = allResposes[2];
        return Promise.all([
          bookingResponse.json(),
          eventsCurrentResponse.json(),
          eventsRepeatResponse.json(),
        ]);
      })
      .then(function ([bookings, eventsCurrent, eventsRepeat]) {
        console.log(bookings);
        console.log(eventsCurrent);
        console.log(eventsRepeat);
        thisBooking.parseData(bookings, eventsCurrent, eventsRepeat);
      });
  }

  parseData(bookings, eventsCurrent, eventsRepeat) {
    const thisBooking = this;

    thisBooking.booked = {};

    for (let item of bookings) {
      thisBooking.makeBooked(item.date, item.hour, item.duration, item.table);
    }

    for (let item of eventsCurrent) {
      thisBooking.makeBooked(item.date, item.hour, item.duration, item.table);
    }

    const minDate = thisBooking.datePicker.minDate;
    const maxDate = thisBooking.datePicker.maxDate;

    for (let item of eventsRepeat) {
      if (item.repeat == 'daily') {
        for (let loopDate = minDate; loopDate <= maxDate; loopDate = utils.addDays(loopDate, 1)) {
          thisBooking.makeBooked(utils.dateToStr(loopDate), item.hour, item.duration, item.table);
        }
      }
    }

    //console.log('thisBooked.booked', thisBooking.booked);
    thisBooking.updateDOM();
  }

  makeBooked(date, hour, duration, table) {
    const thisBooking = this;

    if (typeof thisBooking.booked[date] == 'undefined') {
      thisBooking.booked[date] = {};
    }

    const startHour = utils.hourToNumber(hour);

    for (let hourBlock = startHour; hourBlock < startHour + duration; hourBlock += 0.5) {
      if (typeof thisBooking.booked[date][hourBlock] == 'undefined') {
        thisBooking.booked[date][hourBlock] = [];
      }

      thisBooking.booked[date][hourBlock].push(table);
    }
  }

  updateDOM() {
    const thisBooking = this;

    thisBooking.date = thisBooking.datePicker.value;
    thisBooking.hour = utils.hourToNumber(thisBooking.hourPicker.value);

    let allAvailable = false;

    if (
      typeof thisBooking.booked[thisBooking.date] == 'undefined'
      ||
      typeof thisBooking.booked[thisBooking.date][thisBooking.hour] == 'undefined'
    ) {
      allAvailable = true;
    }

    for (let table of thisBooking.dom.tables) {
      let tableId = table.getAttribute(settings.booking.tableIdAttribute);
      if (!isNaN(tableId)) {
        tableId = parseInt(tableId);
      }

      if (
        !allAvailable
        &&
        thisBooking.booked[thisBooking.date][thisBooking.hour].includes(tableId)
      ) {
        table.classList.add(classNames.booking.tableBooked);
      } else {
        table.classList.remove(classNames.booking.tableBooked);
      }
    }
  }

  render(element) {
    const thisBooking = this;

    /* Generating HTML using templates.bookingWidget without giving it any argument */
    const generatedHtml = templates.bookingWidget();
    thisBooking.dom = {};
    thisBooking.dom.wrapper = element;
    thisBooking.dom.wrapper.innerHTML = generatedHtml;
    thisBooking.dom.tables = thisBooking.dom.wrapper.querySelectorAll(select.booking.tables);
    thisBooking.dom.datePicker = thisBooking.dom.wrapper.querySelector(select.widgets.datePicker.wrapper);
    thisBooking.dom.hourPicker = thisBooking.dom.wrapper.querySelector(select.widgets.hourPicker.wrapper);
    thisBooking.dom.peopleAmount = thisBooking.dom.wrapper.querySelector(select.booking.peopleAmount);
    thisBooking.dom.hoursAmount = thisBooking.dom.wrapper.querySelector(select.booking.hoursAmount);

    
    thisBooking.dom.wrapper.addEventListener('submit', function(event){
      event.preventDefault();
      thisBooking.sendBooking();
    });
  }

  initWidgets() {
    const thisBooking = this;

    thisBooking.peopleAmount = new AmountWidget(thisBooking.dom.peopleAmount);
    thisBooking.hoursAmount = new AmountWidget(thisBooking.dom.hoursAmount);
    thisBooking.datePicker = new DatePicker(thisBooking.dom.datePicker);
    thisBooking.hourPicker = new HourPicker(thisBooking.dom.hourPicker);

    thisBooking.dom.wrapper.addEventListener('updated', function () {
      thisBooking.updateDOM();
    });
  }

  tableSelect() {
    const thisBooking = this;
    let count = 0;

    for (let table of thisBooking.dom.tables) {

      table.addEventListener('click', function () {
        if (!table.classList.contains(classNames.booking.tableBooked) && count == 0) {
          for (let table of thisBooking.dom.tables) {
            if (table.classList.contains(classNames.booking.tableBooked && 'selected')) {
              table.classList.remove(classNames.booking.tableBooked, 'selected');
            }
          }
          table.classList.add(classNames.booking.tableBooked, 'selected');
          table.classList.remove('available');
          count=1;
        } 
        if (!table.classList.contains(classNames.booking.tableBooked) && count == 1) {
          for (let table of thisBooking.dom.tables) {
            if (table.classList.contains(classNames.booking.tableBooked && 'selected')) {
              table.classList.remove(classNames.booking.tableBooked, 'selected');
            }
          }
          table.classList.add(classNames.booking.tableBooked, 'selected');
          count=0;
        }
      });
    }


    /*
    for (let table of thisBooking.dom.tables){
      table.addEventListener('click', function(){
        if(!table.classList.contains(classNames.booking.tableBooked)){
        table.classList.add(classNames.booking.tableBooked, "selected"); 
        }
        else if (table.classList.contains(classNames.booking.tableBooked) && table.classList.contains("selected")){
          table.classList.remove(classNames.booking.tableBooked, "selected");
        }
      });
    }*/
  }

  sendBooking() {
    const thisBooking = this;
    /*let selectedTable={};

    const url = settings.db.url + '/' + settings.db.booking;
    for (let table of thisBooking.dom.tables){
      if(table.classList.contains(classNames.booking.tableBooked && 'selected')){
        selectedTable = table.innerHTML;
      }
    }*/

    const booked = {
      //table: selectedTable,
      date: thisBooking.datePicker.value,
      hour: thisBooking.hourPicker.value,
      duration: thisBooking.duration,
      phone: thisBooking.phone,
      address: thisBooking.address,
    };

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },body: JSON.stringify(booked),
    };

    fetch(url, options)
      .then(function (response) {
        return response.json();
      });/*.then(function (parsedResponse) {
        console.log('parsedResponse', parsedResponse);
      });*/
  }
}

export default Booking;