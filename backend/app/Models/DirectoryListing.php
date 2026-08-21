<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DirectoryListing extends Model
{
    protected $table = 'directory_listings';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['user_id', 'member_id', 'company_name', 'slug', 'description', 'industry', 'website', 'email', 'phone', 'address', 'city', 'logo_url', 'images', 'services', 'status', 'featured', 'approved_at', 'approved_by'];


    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = \Illuminate\Support\Str::uuid()->toString();
            }
        });
    }
}
