// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// Copyright 2019 Silei Xu <silei@cs.stanford.edu>
//
// See LICENSE for details
"use strict";

const Tp = require('thingpedia');
const URL = "https://api.yelp.com/v3/businesses";

function prettyprintAddress(address) {
    if (address.display_address)
        return address.display_address.join(', ');

    return [
        address.address1,
        address.address2,
        address.address3,
        address.city,
        address.country === 'US' ? address.state + ' ' + address.zip_code : address.country
    ].filter((i) => i.length > 0).join(', ');

}

function approximateDistance(distance) {
    if (distance < 100)
        return Math.round(distance);
    if (distance < 1000)
        return distance - distance % 10;
    if (distance < 10000)
        return { value: (distance - distance % 100) / 1000, unit: 'km' };
    else
        return { value: Math.round(distance / 1000), unit: 'km' };
}

module.exports = class YelpDevice extends Tp.BaseDevice {
    constructor(engine, state) {
        super(engine, state);

        this.name = "Yelp";
        this.description = "Yelp search for Almond ";
    }

    _get_details(id) {
        const url = `${URL}/${id}`;
        return Tp.Helpers.Http.get(url, {
            auth: 'Bearer ' + this.constructor.metadata.auth.api_key
        });
    }

    get_search(params) {
        let url = `${URL}/search?limit=5&categories=restaurants&`;
        if (params.location.display)
            url += `location=${encodeURIComponent(params.location.display)}`;
        else
            url += `latitude=${params.location.lat}&longitude=${params.location.lon}`;
        if (params.query)
            url += `&term=${encodeURIComponent(params.query.value)}`;
        if (params.radius)
            url += `&radius=${params.radius.value}`;
        if (params.sort_by)
            url += `&sort_by=${params.sort_by.value}`;
        return Tp.Helpers.Http.get(url, {
            auth: 'Bearer ' + this.constructor.metadata.auth.api_key
        }).then((response) => {
            const parsed = JSON.parse(response);
            return Promise.all(parsed.businesses.map((b) => {
                return this._get_details(b.id).then((response) => {
                    const parsed = JSON.parse(response);
                    return {
                        name: parsed.name,
                        picture_url: parsed.image_url,
                        rating: parsed.rating,
                        review_count: parsed.review_count,
                        address: new Tp.Value.Location(
                            parsed.coordinates.latitude,
                            parsed.coordinates.longitude,
                            prettyprintAddress(parsed.location)
                        ),
                        link: parsed.url,
                        distance: b.distance,
                        phone: parsed.phone,
                        open: !parsed.is_closed,
                        category: parsed.categories.map((c) => c.title),
                    };
                });
            }));
        });
    }

};
